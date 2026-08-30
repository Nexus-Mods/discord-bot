import {
    SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType,
    type CommandInteraction, type ChatInputCommandInteraction,
} from 'discord.js';
import type { ClientExt, DiscordInteraction } from '../types/DiscordTypes.js';
import { KnownDiscordServers, type Logger } from '../api/util.js';
import {
    runBackfill, credentialReport, tokenCensus, BackfillAlreadyRunningError,
    type BackfillProgress,
} from '../db/backfillTokens.js';

/**
 * Owner-only controls for the OAuth token encryption rollout (Phase 3.4).
 *
 * **This command is temporary.** It exists to run a one-time migration from wherever
 * the person running it happens to be, rather than from an SSH session on the droplet,
 * and it should be deleted once the backfill is done and the plaintext tolerance has
 * been removed from `openToken`. After that point it can only do harm: a command that
 * rewrites every credential in the database has no business being permanently
 * reachable. `/tokens report` is the only subcommand worth keeping, if any.
 *
 * Running it here rather than on the droplet has one property worth naming, because it
 * is the failure mode that would be unrecoverable: the backfill uses the same
 * TOKEN_ENCRYPTION_KEY the bot is using, because it *is* the bot. Sealing succeeds with
 * any valid key, so a run against the wrong one would not fail - it would quietly make
 * every row it touched unreadable.
 */

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
        .setName('tokens')
        .setDescription('Manage OAuth token encryption at rest.')
        .setContexts(InteractionContextType.Guild)
        // Belt and braces. `ownerOnly` is the check that matters; this only keeps the
        // command out of the picker for everyone else.
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((s) => s
            .setName('report')
            .setDescription('How many account links are healthy, expired, or unusable.'))
        .addSubcommand((s) => s
            .setName('verify')
            .setDescription('How many stored tokens are encrypted vs still plaintext.'))
        .addSubcommand((s) => s
            .setName('backfill')
            .setDescription('Encrypt every plaintext token. Safe to run while the bot is live.')
            .addBooleanOption((o) => o
                .setName('dry_run')
                .setDescription('Report what would change without writing anything.'))
            .addIntegerOption((o) => o
                .setName('batch')
                .setDescription('Rows per query. Default 250.')
                .setMinValue(1)
                .setMaxValue(5000)))
        .addSubcommand((s) => s
            .setName('status')
            .setDescription('Progress of a backfill started on this shard.')),
    public: false,
    guilds: [KnownDiscordServers.BotDemo],
    ownerOnly: true,
    defer: 'ephemeral',
    action,
};

/**
 * The last run started in this process, so `/tokens status` can answer after the
 * interaction that started it has expired.
 *
 * Deliberately per-process and not persisted. Under sharding a guild's interactions
 * always reach the same shard, so scoping this command to one server means `status`
 * lands in the process that holds the state. If the container restarts mid-run the
 * state is lost - but the database work is resumable, so the answer is to run the
 * backfill again, which is safe.
 */
let lastRun: BackfillProgress | undefined;
let running = false;

/** Discord invalidates an interaction token 15 minutes after it was created. */
const INTERACTION_TOKEN_TTL_MS = 15 * 60 * 1000;
/** Stop editing with enough margin that the final edit is not the one that fails. */
const EDIT_UNTIL_MS = INTERACTION_TOKEN_TTL_MS - 90 * 1000;
const EDIT_INTERVAL_MS = 4000;

async function action(client: ClientExt, baseInteraction: CommandInteraction, logger: Logger): Promise<void> {
    const interaction = baseInteraction as ChatInputCommandInteraction;
    const subcommand = interaction.options.getSubcommand();

    try {
        switch (subcommand) {
            case 'report': return await report(interaction);
            case 'verify': return await verify(interaction);
            case 'status': return await status(interaction, client);
            case 'backfill': return await backfill(interaction, client, logger);
            default:
                await interaction.editReply({ content: `Unknown subcommand: ${subcommand}` });
        }
    }
    catch (err) {
        logger.error('Token command failed', err, { subcommand });
        await interaction.editReply({
            content: `Failed: ${(err as Error).message ?? err}`,
            embeds: [],
        }).catch(() => undefined);
    }
}

async function report(interaction: ChatInputCommandInteraction): Promise<void> {
    const r = await credentialReport();
    const embed = new EmbedBuilder()
        .setTitle('Credential state')
        .setColor('#2D5D7C')
        .addFields(
            { name: 'Rows', value: n(r.rows), inline: true },
            { name: 'Usable links', value: n(r.nexus_usable), inline: true },
            { name: 'Unusable', value: n(r.nexus_unusable), inline: true },
            {
                name: 'Expired but recoverable',
                value: `${n(r.expired_but_recoverable)}\nHealthy — these hold a refresh token and repair themselves on next use.`,
            },
            {
                name: 'Cannot recover without re-linking',
                value: `${n(r.nexus_unusable)} (${n(r.entirely_blank)} entirely blank)\nThese users are already being told to link again today.`,
            },
            {
                name: 'Discord side',
                value: `${n(r.discord_unusable)} missing Discord tokens, of which ${n(r.nexus_only)} still have working Nexus tokens.`,
            },
        )
        .setFooter({ text: 'Expired is not the same as unusable. Only the second number is a candidate for pruning.' });

    await interaction.editReply({ embeds: [embed] });
}

async function verify(interaction: ChatInputCommandInteraction): Promise<void> {
    const c = await tokenCensus();
    const done = c.plaintext === 0;
    const embed = new EmbedBuilder()
        .setTitle('Token encryption census')
        .setColor(done ? '#1C6A5E' : '#9C5518')
        .addFields(
            { name: 'Rows', value: n(c.rows), inline: true },
            { name: 'Encrypted', value: n(c.sealed), inline: true },
            { name: 'Plaintext', value: n(c.plaintext), inline: true },
            { name: 'Empty or unset', value: n(c.empty), inline: true },
        )
        .setDescription(done
            ? 'Every stored token is encrypted. The plaintext is still in the heap as dead tuples until `VACUUM FULL users` runs — until then a dump still contains it.'
            : 'Some tokens are still plaintext. Run `/tokens backfill` to convert them.');

    await interaction.editReply({ embeds: [embed] });
}

async function status(interaction: ChatInputCommandInteraction, client: ClientExt): Promise<void> {
    if (!lastRun) {
        await interaction.editReply({
            content: `No backfill has run on this shard${shardLabel(client)}. If one was started before the last restart, its progress is not recorded — running it again is safe and resumes where it stopped.`,
        });
        return;
    }
    await interaction.editReply({ embeds: [progressEmbed(lastRun, client)] });
}

/**
 * Start a backfill and report on it until the interaction token runs out.
 *
 * The run is deliberately **not** awaited by the reply loop. Against production this
 * takes minutes, and an interaction token dies after fifteen of them; tying the work's
 * lifetime to the reply's would mean a run that overran was also a run that got
 * abandoned. Instead the promise is left to finish on its own and the loop just watches
 * `progress`, so the worst case is a stale reply, not a half-converted table.
 */
async function backfill(interaction: ChatInputCommandInteraction, client: ClientExt, logger: Logger): Promise<void> {
    if (running) {
        await interaction.editReply({
            content: 'A backfill is already running on this shard. Use `/tokens status` to watch it.',
        });
        return;
    }

    const dryRun = interaction.options.getBoolean('dry_run') ?? false;
    const batch = interaction.options.getInteger('batch') ?? undefined;

    let progress: BackfillProgress | undefined;
    let settled = false;
    let failure: Error | undefined;

    running = true;
    logger.info('Backfill started from Discord', { by: interaction.user.tag, dryRun, batch });

    // Handlers attached synchronously: an unhandled rejection here would take the shard
    // down with it.
    const run = runBackfill({ dryRun, batch }, (p) => { progress = p; lastRun = p; })
        .catch((err: Error) => { failure = err; return undefined; })
        .finally(() => { settled = true; running = false; });

    const deadline = interaction.createdTimestamp + EDIT_UNTIL_MS;

    while (!settled && Date.now() < deadline) {
        await sleep(EDIT_INTERVAL_MS);
        if (settled) break;
        if (progress) {
            await interaction.editReply({ embeds: [progressEmbed(progress, client)] }).catch(() => undefined);
        }
    }

    if (!settled) {
        // Out of time, not out of work. Say so plainly rather than leaving a progress
        // bar that will never move again.
        await interaction.editReply({
            embeds: [progressEmbed(progress, client)],
            content: '**Still running.** This reply can no longer be updated — Discord expires an interaction after 15 minutes. Use `/tokens status` to follow the rest.',
        }).catch(() => undefined);
        return;
    }

    await run;

    if (failure) {
        const known = failure instanceof BackfillAlreadyRunningError;
        await interaction.editReply({
            content: known
                ? 'Another backfill is already running — possibly on the droplet or another shard. Nothing was changed.'
                : `Backfill failed: ${failure.message}`,
            embeds: progress ? [progressEmbed(progress, client)] : [],
        }).catch(() => undefined);
        return;
    }

    await interaction.editReply({ content: '', embeds: [progressEmbed(lastRun, client)] }).catch(() => undefined);
}

function progressEmbed(p: BackfillProgress | undefined, client: ClientExt): EmbedBuilder {
    if (!p) return new EmbedBuilder().setTitle('Backfill starting').setColor('#2D5D7C');

    const finished = p.phase === 'done' || p.phase === 'failed';
    const elapsed = Math.round(((p.finishedAt ?? Date.now()) - p.startedAt) / 1000);
    const remaining = p.plaintextRemaining;

    const embed = new EmbedBuilder()
        .setTitle(p.dryRun ? 'Backfill (dry run)' : 'Backfill')
        .setColor(p.phase === 'failed' ? '#9C5518' : finished ? '#1C6A5E' : '#2D5D7C')
        .setDescription(`${phaseLabel(p)}${shardLabel(client)}`)
        .addFields(
            { name: 'Scanned', value: p.total ? `${n(p.scanned)} / ${n(p.total)}` : n(p.scanned), inline: true },
            { name: 'Converted', value: `${n(p.converted)} rows`, inline: true },
            { name: 'Already sealed', value: n(p.skipped), inline: true },
            { name: 'Values written', value: n(p.columns), inline: true },
            { name: 'Raced', value: n(p.raced), inline: true },
            { name: 'Elapsed', value: `${elapsed}s`, inline: true },
        );

    if (p.error) embed.addFields({ name: 'Error', value: `\`${p.error.slice(0, 900)}\`` });

    if (p.phase === 'done') {
        if (p.dryRun) {
            embed.setFooter({ text: 'Nothing was written. Run again without dry_run to apply.' });
        }
        else if (remaining === 0) {
            embed.setFooter({ text: 'Every token is encrypted. Now run VACUUM FULL users — until then the plaintext is still in the heap.' });
        }
        else {
            embed.addFields({ name: 'Still plaintext', value: n(remaining ?? 0) });
            embed.setFooter({ text: 'Run again to pick these up. If the count does not fall, investigate before continuing.' });
        }
    }

    return embed;
}

function phaseLabel(p: BackfillProgress): string {
    switch (p.phase) {
        case 'starting': return 'Starting…';
        case 'counting': return 'Counting what needs converting…';
        case 'walking': return 'Converting…';
        case 'retrying': return 'Re-reading rows the bot wrote to mid-run…';
        case 'verifying': return 'Verifying…';
        case 'done': return p.dryRun ? 'Dry run complete.' : 'Complete.';
        case 'failed': return 'Failed.';
    }
}

function shardLabel(client: ClientExt): string {
    const id = client.shard?.ids?.[0];
    return id === undefined ? '' : ` (shard ${id})`;
}

const n = (value: number) => value.toLocaleString('en-GB');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export { discordInteraction };
