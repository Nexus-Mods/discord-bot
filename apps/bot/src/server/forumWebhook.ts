import { EmbedBuilder, type RESTPostAPIWebhookWithTokenJSONBody } from 'discord.js';
import type { Logger } from "@nexusmods/core/logger.js";
import type { ForumPost, ForumTopic } from '../types/ForumWebhookTypes.js';
import type express from 'express';
import { htmlToText } from 'html-to-text';
import { getTopic } from './forumAPI.js';
import { checkSharedSecret } from '@nexusmods/auth/signing.js';
// Loads .env by walking up from the code, not from the working directory.
import '@nexusmods/core/env.js';

const FORUM_SUGGESTION_FORUM_ID = 9063; // The ID of the forum for suggestions.
const SUGGESTION_ICON = 'https://staticdelivery.nexusmods.com/images/2295/31179975-1744285207.png'; // The icon for the suggestion forum.

/**
 * The shared secret, carried in the query string because there is nowhere else to put it.
 *
 * This was S3: the endpoint took a 5MB POST from anyone who knew the URL and rendered it
 * into a Discord channel, with the payload controlling the embed's clickable link, the
 * author name, the avatar image and the text. The `forum.id === 9063` check below is no
 * defence, because it reads the id out of the same body.
 *
 * Invision attaches no headers of its own and this installation cannot be made to, so the
 * target URL is the only part of the request the sending side lets anyone configure.
 *
 * Fails closed, via the same comparison the automod and admin endpoints use: with
 * FORUM_WEBHOOK_SECRET unset, every request is refused. That means the URL in the forum's
 * webhook settings has to carry `?key=...` BEFORE this deploys, or suggestions stop. The
 * old code ignores an unknown query parameter, so adding it first is safe and is the
 * order DEPLOYING.md gives.
 */
function authorised(req: express.Request): boolean {
    const provided = req.query['key'];
    return checkSharedSecret(typeof provided === 'string' ? provided : undefined, 'FORUM_WEBHOOK_SECRET');
}

export default async function forumWebhook(req: express.Request, res: express.Response, logger: Logger): Promise<void>{
    // Before the 200, and before anything reads the body.
    if (!authorised(req)) {
        logger.warn('Rejected an unauthenticated forum webhook');
        res.sendStatus(401);
        return;
    }

    const data = req.body;
    res.status(200).send('OK');

    if (data.title && data.firstPost) {
        // Assume it's a topic. 
        const topic = data as ForumTopic;
        if (topic.hidden) return; // Ignore hidden topics.
        const title = topic.title;
        const author = topic.firstPost.author.name;
        const url = topic.url;
        if (topic.forum.id === 9063) {
            logger.info('New suggestion via forum webhook', { title, author, url, content: htmlToText(topic.firstPost.content, { wordwrap: false }), hidden: topic.hidden });

            const embed = new EmbedBuilder()
            .setTitle(`New Suggestion ${topic.prefix ? `(${topic.prefix})`: ``}`)
            .setColor('Orange')
            .setAuthor({name: author, iconURL: topic.firstPost.author.photoUrl})
            .setURL(url)
            .setDescription(`**${title}**\n\n${htmlToText(topic.firstPost.content).substring(0, 2000)}`)
            .setTimestamp(new Date(topic.firstPost.date))
            .setThumbnail(SUGGESTION_ICON)
            .setFooter({text: `Tags: ${topic.tags.length ? topic.tags.join(', ') : 'None'}`});

            const webhookMessage: RESTPostAPIWebhookWithTokenJSONBody = { embeds: [embed.data] };
            // Send the embed to the suggestion channel.
            try {
                await postToDiscord(webhookMessage, logger);
            }
            catch(_err) {
                return;
            }
            
        }
        // else logger.info('New non-suggestion topic via forum webhook', { title, author, url });
    }
    else if (data.item_id && data.author) {
        // CLOUDFLARE SUCKS SO HARD, I ABANDONNED THIS CODE AS IT WAS BLOCKING THE FORUM API!
        return;
        // Assume it's a post.
        const post = data as ForumPost;
        if (post.hidden) return; // Ignore hidden posts.
        const threadId = post.item_id;
        const url = post.url;
        const author = post.author.name;
        logger.info('New post via forum webhook', { threadId, url, author, content: htmlToText(post.content) });
        // We need to get the thread info to make sure it's in the suggestion forum.
        const topic = await getTopic(threadId).catch((err) => {
            logger.warn('Could not get topic for post', { threadId, url, err });
            return null;
        });
        if (!topic) return;
        // If this post is the first post in a thread we can ignore it.
        if (topic?.firstPost.id === post.id) return;
        // Only process posts in the suggestion forum.
        if (topic?.forum.id === FORUM_SUGGESTION_FORUM_ID) {
            const embed = new EmbedBuilder()
            .setTitle('New Suggestion Reply')
            .setColor('Orange')
            .setAuthor({name: author, iconURL: post.author.photoUrl})
            .setURL(url)
            .setThumbnail(SUGGESTION_ICON)
            .setDescription(`**${topic?.title}**\n\n${htmlToText(post.content).substring(0, 2000)}`)
            .setTimestamp(new Date(post.date))
            .setFooter({text: `Tags: ${topic?.tags.join(', ')}`, iconURL: SUGGESTION_ICON});
            
            
            const webhookMessage: RESTPostAPIWebhookWithTokenJSONBody = { embeds: [embed.data] };
            // Send the embed to the suggestion channel.
            try {
                await postToDiscord(webhookMessage, logger);
            }
            catch(_err) {
                return;
            }
            
        }
        else return;
    }
    // else {
    //     logger.warn('Unknown event type for forum webhook', {data});
    // }
}

async function postToDiscord(webhookMessage: RESTPostAPIWebhookWithTokenJSONBody, logger: Logger): Promise<PromiseSettledResult<void>[]> {
    const discordWebhooks =(process.env.DISCORD_SUGGESTION_WEBHOOKS ?? '').split(',').map((s) => s.trim()).filter((s) => s.length > 0) as string[];
            if (discordWebhooks.length === 0) {
                logger.warn('No webhooks configured for suggestions');
                return [];
            };
            const posts = discordWebhooks.map(async (webhook) => {
                try {
                    // fetch does not throw on a non-2xx response the way axios did, so
                    // the status has to be checked rather than assumed.
                    const discordResponse = await fetch(webhook, {
                        method: 'POST',
                        body: JSON.stringify(webhookMessage, null, 2),
                        headers: { 'Content-Type': 'application/json' },
                    });
                    if (discordResponse.ok) return;
                    throw new Error(`Discord webhook returned an error: ${discordResponse.status} ${discordResponse.statusText}`);
                }
                catch(err) {
                    logger.warn('Error posting Discord Webhook', err, true);
                    return;
                }
            });
            return Promise.allSettled(posts);
}

/*
 * The sample payloads that used to be here have been removed.
 *
 * They were real events captured from the live forum, so they carried a real member
 * email address and a registration IP address - in a public repository, in a comment
 * nobody had reason to read. The types in types/ForumWebhookTypes.ts describe the same
 * shape without the data, which is what the comment was for.
 */