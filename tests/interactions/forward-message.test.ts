import { describe, it, expect } from 'vitest';
import { MessageReferenceType } from 'discord.js';
import type { Message, Snowflake } from 'discord.js';
import { attributionLine, forwardBody, discordInteraction } from '../../src/interactions/forward-message.js';

/**
 * The two pure halves of the forward command. Everything else in it is a REST call and
 * an error branch, but these are where a silent mistake reaches Discord: a wrong field
 * name is a 400 at the moment someone is trying to report something, and the attribution
 * is the only record of who sent it.
 */

const msg = (over: Partial<{ id: Snowflake; channelId: Snowflake; guildId: Snowflake | null }> = {}) => ({
    id: '111', channelId: '222', guildId: '333', ...over,
});

describe('forwardBody', () => {
    it('builds a forward reference, not a reply', () => {
        // type 0 is Default, which Discord treats as a reply - it would quote the message
        // instead of forwarding it, and would look almost right.
        expect(forwardBody(msg()).message_reference.type).toBe(MessageReferenceType.Forward);
        expect(MessageReferenceType.Forward).toBe(1);
    });

    it('carries the message, channel and guild the API expects', () => {
        expect(forwardBody(msg()).message_reference).toEqual({
            type: MessageReferenceType.Forward,
            message_id: '111',
            channel_id: '222',
            guild_id: '333',
        });
    });

    it('omits guild_id rather than sending null', () => {
        // Discord rejects a null guild_id; undefined is dropped from the JSON body.
        const ref = forwardBody(msg({ guildId: null })).message_reference;
        expect(ref.guild_id).toBeUndefined();
        expect(JSON.stringify(ref)).not.toContain('guild_id');
    });
});

describe('attributionLine', () => {
    const message = {
        id: '111', channelId: '222', guildId: '333',
        guild: { name: 'Some Server' },
        channel: { name: 'general' },
        author: { tag: 'poster', id: '999' },
    } as unknown as Message;

    it('records who forwarded it, who wrote it, and where from', () => {
        const line = attributionLine(message, { tag: 'themod', id: '444' });
        expect(line).toContain('themod');
        expect(line).toContain('444');
        expect(line).toContain('poster');
        expect(line).toContain('999');
        expect(line).toContain('Some Server');
        expect(line).toContain('#general');
    });

    it('links back to the original', () => {
        expect(attributionLine(message, { tag: 'm', id: '1' }))
            .toContain('https://discord.com/channels/333/222/111');
    });

    it('survives a channel or guild it cannot name', () => {
        // The bot may not have the source guild cached - a forward from a server on
        // another shard is the normal case for this command, not the edge case.
        const bare = { ...message, guild: null, channel: {} } as unknown as Message;
        expect(() => attributionLine(bare, { tag: 'm', id: '1' })).not.toThrow();
        expect(attributionLine(bare, { tag: 'm', id: '1' })).toContain('unknown server');
    });
});

describe('the command itself', () => {
    it('is a message context-menu command, not a slash command', () => {
        expect(discordInteraction.command.toJSON().type).toBe(3);
    });

    it('is gated on ManageMessages and not registered globally', () => {
        // It writes into one shared Nexus Mods channel from other servers. Global
        // registration would hand that to every moderator of every server the bot is in.
        expect(discordInteraction.public).toBe(false);
        expect(discordInteraction.guilds?.length).toBeGreaterThan(0);
        expect(discordInteraction.requiredPermissions).toBeDefined();
    });
});
