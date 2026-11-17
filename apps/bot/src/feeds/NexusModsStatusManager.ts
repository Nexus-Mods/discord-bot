import { EmbedBuilder, type TextChannel, WebhookClient } from 'discord.js';
import type { ClientExt } from "../types/DiscordTypes.js";
import { ownsGuild, postStatusPageOnOwningShard, requireShard, shardIdForGuild } from '../lib/sharding.js';
import type { Logger } from "@nexusmods/core/logger.js";
import { voidAsync } from '../lib/async.js';
import { WebsiteStatusIncidents, WebsiteStatusMaintenances } from '@nexusmods/nexus-api/queries/statuspage.js';
import { baseheader } from '@nexusmods/nexus-api/headers.js';
import type { IStatusPageIncident, IStatusPageIncidentUpdate } from '@nexusmods/nexus-api/types/responses.js';
import { postedUpdateIds, markUpdatesPosted, pruneOldUpdates } from '@nexusmods/persistence/status.js';
import type { StatusPost, StatusUpdateEntry } from '../types/StatusPageTypes.js';
import { siteStatusUpdateEmbed } from './nexusModsStatusEmbeds.js';


const pollTime = (1000*60*5)*1; //5 mins

/** Incidents posted in one poll. A burst goes out over several rather than all at once. */
const MAX_POSTS_PER_POLL = 10;

export class NexusModsStatusManager {
    private static instance: NexusModsStatusManager;

    private client: ClientExt;
    private updateTimer: NodeJS.Timeout | undefined;
    private logger: Logger;

    private webhook_id: string | undefined = process.env['NEWS_WEBHOOK_ID'];
    private webhook_token: string | undefined = process.env['NEWS_WEBHOOK_TOKEN'];
    private webhook_guild: string | undefined = process.env['NEWS_WEBHOOK_GUILD'];
    private webhook_channel: string | undefined = process.env['NEWS_WEBHOOK_CHANNEL'];

    static async getInstance(client: ClientExt, logger: Logger): Promise<NexusModsStatusManager> {
        // No saved state to load: what has been posted lives in the database and is read
        // per poll, so there is nothing to hold between runs.
        if (!NexusModsStatusManager.instance) {
            NexusModsStatusManager.instance = new NexusModsStatusManager(client, pollTime, logger);
        }

        return NexusModsStatusManager.instance;
    }

    private static isInstanceForShard = (client: ClientExt): boolean =>
        ownsGuild(client, process.env['NEWS_WEBHOOK_GUILD']!);

    private constructor(client: ClientExt, pollTime: number, logger: Logger) {
        this.client = client;
        this.logger = logger;

        // The news feed's guard was inverted once: the timer was installed everywhere
        // EXCEPT the shard holding the guild, so every post round-tripped through
        // broadcastEval. Same shape here, the right way round.
        if (!NexusModsStatusManager.isInstanceForShard(client)) {
            this.logger.debug('Status webhook guild not found in this shard. Will not post status updates from here.');
            return;
        }

        // Set the update interval.
        this.updateTimer = setInterval(
            voidAsync(this.logger, 'status feed poll', () => this.postLatestStatus()),
            pollTime,
        );
        logger.info('Initialised status feed, checking every 5mins.')
    }

    /**
     * Entry point for a poll another shard could not make itself, because this process is
     * the one holding the status guild. Public for the same reason as
     * SubscriptionManger.handleRefreshRequest - it is invoked across a process boundary.
     */
    public async handleStatusPageRequest(): Promise<EmbedBuilder[]> {
        return this.postLatestStatus();
    }

    private async postLatestStatus(): Promise<EmbedBuilder[]> {
        // Check this is the right shard
        if (!NexusModsStatusManager.isInstanceForShard(this.client)) {
            const correctShard = shardIdForGuild(this.client, process.env['NEWS_WEBHOOK_GUILD']!);
            this.logger.debug('Status page webhook not handled by this shard, passing on.', correctShard);
            if (requireShard(this.client).ids[0] === correctShard) {
                throw new Error('This shard owns the status updates but isInstanceForShard disagrees.');
            }
            const embeds = await postStatusPageOnOwningShard(this.client, correctShard);
            if (!embeds) {
                this.logger.warn('No shards could post status page update');
                throw new Error('No shards able to post status page update.')
            }
            return embeds.map(e => new EmbedBuilder(e));
        }

        this.logger.debug("Checking status page updates");
        let updates: StatusUpdateEntry[];
        // Fetch the latest info from the API
        try {
            const [incidents, maintenances] = await Promise.all([
                WebsiteStatusIncidents(baseheader, this.logger),
                WebsiteStatusMaintenances(baseheader, this.logger)
            ]);
            // Flatten into a single list of updates
            updates = flattenStatusPageUpdates(incidents.incidents, maintenances.scheduled_maintenances)
        }
        catch(e: unknown) {
            this.logger.error("Failed to update status page info from API", e);
            throw new Error("Failed to update status page info from API", { cause: e })
        }

        // Every incident the API still knows about. Anything else in the table can never
        // be posted again, so it is safe to forget - and this must come from the payload,
        // not the database, or the prune deletes the rows it is meant to keep.
        const liveIncidentIds = [...new Set(updates.map(u => u.incident.id))];

        // Read the saved data in the database
        let seenIds = new Set<string>();
        try {
            seenIds = new Set<string>(await postedUpdateIds(this.logger));
        }
        catch(e: unknown) {
            this.logger.error("Failed to fetch known incident data from database", e);
            throw new Error("Failed to fetch known incident data from database", { cause: e })
        }

        // An empty table is a first run: record the history and post none of it. Logged at
        // info because the other way to get here is a table that was emptied by accident,
        // and that silently swallows one real incident.
        if (seenIds.size === 0) {
            this.logger.info("No status updates in the database, recording the history for next run", { updates: updates.length });
            await markUpdatesPosted(this.logger, updates.map(u => u.update));
            return [];
        }

        // One post per incident, newest unseen update first, oldest incident first.
        const unseenUpdates = updates.filter(u => !seenIds.has(u.update.id));
        const postableUpdates = groupByIncident(unseenUpdates, seenIds).slice(0, MAX_POSTS_PER_POLL);

        // Nothing new. Without this the webhook posts its header with no embeds, every
        // five minutes, forever.
        if (!postableUpdates.length) {
            await pruneOldUpdates(this.logger, liveIncidentIds);
            return [];
        }

        // Generate Embeds
        const embeds = postableUpdates.map(u => siteStatusUpdateEmbed(u));

        // Post embeds
        try {
            await this.publishEmbeds(embeds);
        }
        catch(e: unknown) {
            throw new Error("Failed to post status page embeds", { cause: e })
        }

        // Only after the send succeeded, and every update the post stood for - not just
        // the one it rendered, or the ones it collapsed are posted again next poll.
        await markUpdatesPosted(this.logger, postableUpdates.flatMap(p => p.covered));
        this.logger.info('Posted status page updates', {
            incidents: postableUpdates.length,
            updates: postableUpdates.reduce((n, p) => n + p.covered.length, 0),
        });

        // Prune out unused entries
        await pruneOldUpdates(this.logger, liveIncidentIds);

        // Return embeds
        return embeds;
    }

    private async publishEmbeds(embeds: EmbedBuilder[]) {
        if (!this.webhook_id || !this.webhook_token || !this.webhook_guild || !this.webhook_channel) throw new Error('Webhook ID or Token missing from the ENV file');

        const webhookClient = new WebhookClient({ id: this.webhook_id, token: this.webhook_token });

        const whMessage = await webhookClient.send({ content: '# Website Status Update', embeds });

        const guild = await this.client.guilds.fetch(this.webhook_guild);
        const channel = await guild.channels.fetch(this.webhook_channel);
        const message = await (channel as TextChannel).messages.fetch(whMessage.id);

        if (message.crosspostable) {
            await message.crosspost();
            this.logger.info('Status Page Update crossposted');
        }
        else this.logger.warn('Could not crosspost status page update');
    }
}

function flattenStatusPageUpdates(
    incidents: IStatusPageIncident[],
    maintenances: IStatusPageIncident[]
): StatusUpdateEntry[] {
    const pair = (kind: StatusUpdateEntry['kind']) => (incident: IStatusPageIncident) =>
        incident.incident_updates.map((update) => ({ incident, update, kind }));

    const all = [
        ...incidents.flatMap(pair('incident')),
        ...maintenances.flatMap(pair('maintenance'))
    ];

    const byId = new Map<string, StatusUpdateEntry>();
    for (const entry of all) {
        if (!byId.has(entry.update.id)) byId.set(entry.update.id, entry);
    }

    return [...byId.values()]
}

const byCreatedAt = (a: { update: IStatusPageIncidentUpdate }, b: typeof a) =>
    new Date(a.update.created_at).getTime() - new Date(b.update.created_at).getTime();

function groupByIncident(unseen: StatusUpdateEntry[], seenUpdateIds: Set<string>): StatusPost[] {
    const byIncident = new Map<string, StatusUpdateEntry[]>();
    for (const entry of unseen) {
        byIncident.set(entry.incident.id, [...(byIncident.get(entry.incident.id) ?? []), entry]);
    }

    const posts = [...byIncident.values()].map((entries) => {
        const sorted = [...entries].sort(byCreatedAt);
        const newest = sorted[sorted.length - 1];
        // Never mentioned before if none of its updates are in the seen set.
        const isNew = newest.incident.incident_updates.every((u) => !seenUpdateIds.has(u.id));

        return {
            incident: newest.incident,
            latest: newest.update,
            covered: sorted.map((e) => e.update),
            kind: newest.kind,
            change: newest.update.status === 'resolved' ? 'resolved' : isNew ? 'new' : 'update',
        } satisfies StatusPost;
    });

    return posts.sort((a, b) =>
        new Date(a.latest.created_at).getTime() - new Date(b.latest.created_at).getTime());
}
