import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Gateway intents must stay tied to what the code consumes.
 *
 * An intent is a subscription to a firehose: every event it admits is decompressed,
 * parsed, turned into a discord.js object and cached, on every shard, across every
 * guild the bot is in - whether or not a handler exists. This bot requested six
 * intents and consumed one. That is invisible in development, where the bot is in a
 * handful of test servers, and expensive in production, where it is in thousands.
 *
 * These tests read the source rather than importing DiscordBot.ts, which constructs a
 * real Client and reads the token at module scope.
 */
const SOURCE = readFileSync('src/DiscordBot.ts', 'utf8');

function requestedIntents(): string[] {
    return [...SOURCE.matchAll(/IntentsBitField\.Flags\.(\w+)/g)].map((m) => m[1]);
}

describe('gateway intents', () => {
    it('requests Guilds, which the guild and channel caches depend on', () => {
        expect(requestedIntents()).toContain('Guilds');
    });

    // Each of these fed nothing: no reaction handler, no webhookUpdate handler, nothing
    // referencing integrations, and no handler for an incoming DM. createDM and
    // messages.fetch are REST calls and need no intent.
    it.each(['GuildMessageReactions', 'GuildIntegrations', 'GuildWebhooks', 'DirectMessages'])(
        'does not request %s, which nothing consumes',
        (intent) => {
            expect(requestedIntents()).not.toContain(intent);
        },
    );

    // GuildMessages is the expensive one: it cannot be scoped to a single guild, so
    // requesting it unconditionally delivers every message in every server to a handler
    // that discards all but one channel.
    it('requests GuildMessages only when the bait channel is configured', () => {
        expect(SOURCE).toMatch(/if\s*\(\s*process\.env\.WATCHED_CHANNEL_ID\s*\)/);
        const guarded = SOURCE.slice(SOURCE.indexOf('process.env.WATCHED_CHANNEL_ID'));
        expect(guarded).toContain('IntentsBitField.Flags.GuildMessages');
    });

    it('keeps GuildMessages out of the unconditional list', () => {
        const declaration = SOURCE.slice(
            SOURCE.indexOf('const intents: GatewayIntentBits[] = ['),
            SOURCE.indexOf('];', SOURCE.indexOf('const intents: GatewayIntentBits[] = [')),
        );
        expect(declaration).not.toContain('GuildMessages');
    });
});

describe('cache limits', () => {
    // Nothing reads messages.cache; the two callers that want a message use
    // messages.fetch(), which is REST. The discord.js default keeps 200 per channel.
    it('caps the message and reaction caches at zero', () => {
        expect(SOURCE).toContain('MessageManager: 0');
        expect(SOURCE).toContain('ReactionManager: 0');
    });

    it('leaves the member cache alone, so uploader lookups stay cached', () => {
        expect(SOURCE).not.toMatch(/GuildMemberManager:\s*\{/);
    });
});
