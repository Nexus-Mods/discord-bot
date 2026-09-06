import { describe, it, expect } from 'vitest';
import { Colors, EmbedBuilder as DiscordJsEmbedBuilder } from 'discord.js';
import { EmbedBuilder } from '@discordjs/builders';
import { ORANGE, classify } from '@/lib/forum/webhook';

/**
 * The webhook builds its embeds with @discordjs/builders rather than discord.js, because
 * importing EmbedBuilder from discord.js drags the gateway client into the bundle - the
 * build failed on zlib-sync, an optional native dependency of @discordjs/ws.
 *
 * discord.js is a devDependency here for exactly this file: it is the thing the port is
 * being checked against. Two claims are made in that swap and both are checked rather than
 * asserted in a comment.
 */
describe('the swap from discord.js to @discordjs/builders', () => {
    it('uses the number discord.js resolved the colour name to', () => {
        // The Express version says .setColor('Orange'). The name form is a discord.js
        // extension; the builders package takes a number.
        expect(ORANGE).toBe(Colors.Orange);
    });

    it('produces the same embed discord.js would have', () => {
        const build = (b: EmbedBuilder | DiscordJsEmbedBuilder) => b
            .setTitle('New Suggestion (Feature)')
            .setAuthor({ name: 'Pickysaurus', iconURL: 'https://avatars.nexusmods.test/1/100' })
            .setURL('https://forums.nexusmods.test/topic/1-test/')
            .setDescription('**test**\n\nbody')
            .setTimestamp(new Date('2026-04-10T09:47:24Z'))
            .setThumbnail('https://staticdelivery.nexusmods.test/icon.png')
            .setFooter({ text: 'Tags: None' });

        const ported = build(new EmbedBuilder().setColor(ORANGE)).toJSON();
        const original = build(new DiscordJsEmbedBuilder().setColor('Orange')).toJSON();

        expect(ported).toEqual(original);
    });
});

describe('classifying an Invision payload', () => {
    // The Express version branches on `data.title && data.firstPost` for a topic and
    // `data.item_id && data.author` for a reply, and silently ignores anything else.
    it('recognises a topic', () => {
        expect(classify({ title: 't', firstPost: {} })).toBe('topic');
    });

    it('recognises a reply', () => {
        expect(classify({ item_id: 1, author: {} })).toBe('post');
    });

    it('ignores everything else, including things that are not objects', () => {
        for (const junk of [null, undefined, 'a string', 42, [], {}, { title: 't' }, { item_id: 1 }]) {
            expect(classify(junk), JSON.stringify(junk)).toBe('unknown');
        }
    });
});
