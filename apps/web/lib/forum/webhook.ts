import { EmbedBuilder } from '@discordjs/builders';
import type { APIEmbed } from 'discord-api-types/v10';
import type { Logger } from '@nexusmods/core/logger.js';
import { htmlToText } from 'html-to-text';
import type { ForumPost, ForumTopic } from './types';
import { getTopic } from './api';

/**
 * The forum webhook's payload handling, ported from apps/bot/src/server/forumWebhook.ts.
 *
 * Deliberately the same logic, and for one step deliberately a second copy of it: Express
 * still serves /webhook until step 9 and this app cannot import from apps/bot, so the
 * alternatives were a sixth package that step 9 would immediately dissolve, or two copies
 * for exactly one step. The Express one is the reference the plan asks this to be compared
 * against; step 9 deletes it.
 *
 * What did change is the shape: this takes a parsed payload and returns nothing, instead
 * of taking an express request and writing a response. The reply is the route handler's
 * job now, which is also what makes the "answer immediately, then do the work" behaviour
 * explicit rather than a side effect of writing to `res` early.
 *
 * The long comment of sample payloads at the bottom of the Express file is NOT carried
 * over. It contains a real email address and a registration IP - see the commit message;
 * it should come out of the original too.
 *
 * The builders package, not discord.js. `import { EmbedBuilder } from 'discord.js'` pulls
 * the gateway client in behind it - the build failed on `zlib-sync`, an optional native
 * dependency of @discordjs/ws - and this app has no business holding a gateway
 * connection. @discordjs/builders is where EmbedBuilder actually lives; discord.js
 * re-exports it. The architecture tests have said since 4.4.0 that the web side may use
 * Discord's REST and builder helpers but not the gateway, and this is that rule meeting a
 * bundler that enforces it.
 */

/**
 * discord.js's `Colors.Orange`, which is what the Express version's `.setColor('Orange')`
 * resolved to.
 *
 * The name form is a discord.js extension: it overrides setColor to accept a
 * ColorResolvable, while the builders package underneath takes a number. So the name has
 * to become the number, and a test asserts this constant still equals `Colors.Orange`
 * rather than trusting that it was copied correctly.
 */
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

/**
 * Replies, which are switched off.
 *
 * The Express version has an unconditional `return` at the top of this branch with the
 * comment "CLOUDFLARE SUCKS SO HARD, I ABANDONNED THIS CODE AS IT WAS BLOCKING THE FORUM
 * API" - fetching the parent topic for every reply tripped Cloudflare. The code below it
 * is unreachable there.
 *
 * Carried over as a flag rather than as unreachable code, because unreachable code behind
 * an early return reads as live until you find the return. Same behaviour, and the
 * reason is where someone will look for it.
 */
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

/**
 * Post to every configured suggestion webhook.
 *
 * One failure does not stop the others - allSettled, and each post swallows its own error
 * after logging it - because these are independent destinations and a Discord outage on
 * one should not lose the message on the rest.
 */
async function postToDiscord(message: { embeds: APIEmbed[] }, logger: Logger): Promise<void> {
    const webhooks = (process.env.DISCORD_SUGGESTION_WEBHOOKS ?? '')
        .split(',').map((s) => s.trim()).filter((s) => s.length > 0);

    if (webhooks.length === 0) {
        logger.warn('No webhooks configured for suggestions');
        return;
    }

    await Promise.allSettled(webhooks.map(async (webhook) => {
        try {
            // fetch does not throw on a non-2xx the way axios did, so the status is
            // checked rather than assumed.
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
