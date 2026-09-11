import { EmbedBuilder } from '@discordjs/builders';
import type { APIEmbed } from 'discord-api-types/v10';
import type { Logger } from '@nexusmods/core/logger.js';
import { htmlToText } from 'html-to-text';
import type { ForumPost, ForumTopic } from './types';
import { getTopic } from './api';

/**
 * The forum webhook's payload handling. A second copy of the Express one until that is
 * deleted; this takes a parsed payload and returns nothing, leaving the reply to the route.
 *
 * @discordjs/builders, NOT discord.js: importing EmbedBuilder from discord.js pulls the
 * gateway client in behind it and the build fails on zlib-sync.
 */

/** discord.js's Colors.Orange as a number; the builders package takes no colour names. */
export const ORANGE = 0xe67e22;

const FORUM_SUGGESTION_FORUM_ID = 9063;
const SUGGESTION_ICON = 'https://staticdelivery.nexusmods.com/images/2295/31179975-1744285207.png';

/** A topic event carries a title and a first post; a reply event carries an item id and an author. */
export function classify(data: unknown): 'topic' | 'post' | 'unknown' {
    if (!data || typeof data !== 'object') return 'unknown';
    const d = data as Record<string, unknown>;
    if (d.title && d.firstPost) return 'topic';
    if (d.item_id && d.author) return 'post';
    return 'unknown';
}

export async function handleForumEvent(data: unknown, logger: Logger): Promise<void> {
    switch (classify(data)) {
        case 'topic': return handleTopic(data as ForumTopic, logger);
        case 'post': return handlePost(data as ForumPost, logger);
        default: return;
    }
}

async function handleTopic(topic: ForumTopic, logger: Logger): Promise<void> {
    if (topic.hidden) return;
    if (topic.forum.id !== FORUM_SUGGESTION_FORUM_ID) return;

    const title = topic.title;
    const author = topic.firstPost.author.name;
    const url = topic.url;

    logger.info('New suggestion via forum webhook', {
        title, author, url,
        content: htmlToText(topic.firstPost.content, { wordwrap: false }),
        hidden: topic.hidden,
    });

    const embed = new EmbedBuilder()
        .setTitle(`New Suggestion ${topic.prefix ? `(${topic.prefix})` : ''}`)
        .setColor(ORANGE)
        .setAuthor({ name: author, iconURL: topic.firstPost.author.photoUrl })
        .setURL(url)
        .setDescription(`**${title}**\n\n${htmlToText(topic.firstPost.content).substring(0, 2000)}`)
        .setTimestamp(new Date(topic.firstPost.date))
        .setThumbnail(SUGGESTION_ICON)
        .setFooter({ text: `Tags: ${topic.tags.length ? topic.tags.join(', ') : 'None'}` });

    await postToDiscord({ embeds: [embed.toJSON()] }, logger);
}

/** Off: fetching the parent topic for every reply tripped Cloudflare on the forum API. */
const REPLIES_ENABLED = false;

async function handlePost(post: ForumPost, logger: Logger): Promise<void> {
    if (!REPLIES_ENABLED) return;
    if (post.hidden) return;

    const threadId = post.item_id;
    logger.info('New post via forum webhook', {
        threadId, url: post.url, author: post.author.name, content: htmlToText(post.content),
    });

    const topic = await getTopic(threadId).catch((err) => {
        logger.warn('Could not get topic for post', { threadId, url: post.url, err });
        return null;
    });
    if (!topic) return;
    // The first post of a thread arrives as a topic event as well; do not post it twice.
    if (topic.firstPost.id === post.id) return;
    if (topic.forum.id !== FORUM_SUGGESTION_FORUM_ID) return;

    const embed = new EmbedBuilder()
        .setTitle('New Suggestion Reply')
        .setColor(ORANGE)
        .setAuthor({ name: post.author.name, iconURL: post.author.photoUrl })
        .setURL(post.url)
        .setThumbnail(SUGGESTION_ICON)
        .setDescription(`**${topic.title}**\n\n${htmlToText(post.content).substring(0, 2000)}`)
        .setTimestamp(new Date(post.date))
        .setFooter({ text: `Tags: ${topic.tags.join(', ')}`, iconURL: SUGGESTION_ICON });

    await postToDiscord({ embeds: [embed.toJSON()] }, logger);
}

/** Every configured webhook; one failing destination must not lose the message on the rest. */
async function postToDiscord(message: { embeds: APIEmbed[] }, logger: Logger): Promise<void> {
    const webhooks = (process.env.DISCORD_SUGGESTION_WEBHOOKS ?? '')
        .split(',').map((s) => s.trim()).filter((s) => s.length > 0);

    if (webhooks.length === 0) {
        logger.warn('No webhooks configured for suggestions');
        return;
    }

    await Promise.allSettled(webhooks.map(async (webhook) => {
        try {
            // fetch does not throw on a non-2xx, unlike the axios this replaced.
            const response = await fetch(webhook, {
                method: 'POST',
                body: JSON.stringify(message),
                headers: { 'Content-Type': 'application/json' },
            });
            if (response.ok) return;
            throw new Error(`Discord webhook returned an error: ${response.status} ${response.statusText}`);
        }
        catch (err) {
            logger.warn('Error posting Discord Webhook', err, true);
        }
    }));
}
