import { EmbedBuilder, RESTPostAPIWebhookWithTokenJSONBody } from 'discord.js';
import { Logger } from '../api/util';
import { ForumPost, ForumTopic } from '../types/ForumWebhookTypes';
import express from 'express';
import { htmlToText } from 'html-to-text';
import { getTopic } from '../api/forumAPI';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const FORUM_SUGGESTION_FORUM_ID = 9063; // The ID of the forum for suggestions.
const SUGGESTION_ICON = 'https://staticdelivery.nexusmods.com/images/2295/31179975-1744285207.png'; // The icon for the suggestion forum.

export default async function forumWebhook(req: express.Request<{}, {}, any>, res: express.Response, logger: Logger): Promise<void>{
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
            catch(err) {
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
            catch(err) {
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
                    const discordResponse = await axios({
                        method: 'POST',
                        url: webhook,
                        data: JSON.stringify(webhookMessage, null, 2),
                        headers: { 
                            'Content-Type': 'application/json'
                        },
                    });
                    if (discordResponse.status >= 200 && discordResponse.status < 300) return;
                    else throw new Error('Discord webhook returned an error: ' + discordResponse.statusText);
                }
                catch(err) {
                    logger.warn('Error posting Discord Webhook', err, true);
                    return;
                }
            });
            return Promise.allSettled(posts);
}

/*
// Example of the data for the "Topic Created" event
{
    id: 13512654,
    title: 'test',
    forum: {
      id: 8884,
      name: 'General Chat',
      path: 'The Lounge > General Chat',
      type: 'discussions',
      topics: 115,
      url: 'https://forums.nexusmods.com/forum/8884-general-chat/',
      parentId: 8883,
      permissions: [Object],
      club: 0
    },
    posts: 1,
    views: 0,
    prefix: null,
    tags: [],
    firstPost: {
      id: 130502930,
      item_id: 13512654,
      author: [Object],
      date: '2025-04-10T09:47:24Z',
      content: '<p>\n\ttest\n</p>\n',
      hidden: false,
      url: 'https://forums.nexusmods.com/topic/13512654-test/?do=findComment&comment=130502930',
      reactions: []
    },
    lastPost: {
      id: 130502930,
      item_id: 13512654,
      author: [Object],
      date: '2025-04-10T09:47:24Z',
      content: '<p>\n\ttest\n</p>\n',
      hidden: false,
      url: 'https://forums.nexusmods.com/topic/13512654-test/?do=findComment&comment=130502930',
      reactions: []
    },
    bestAnswer: null,
    locked: false,
    hidden: false,
    pinned: false,
    featured: false,
    archived: false,
    poll: null,
    url: 'https://forums.nexusmods.com/topic/13512654-test/',
    rating: 0,
    is_future_entry: 0,
    publish_date: '2025-04-10T09:47:24Z'
  }

  // Example of new post event
  {
    id: 130502932,
    item_id: 13511151,
    author: {
      id: 31179975,
      name: 'Pickysaurus',
      title: null,
      timeZone: 'Europe/London',
      formattedName: "<span style='color:#00a6f4'>Pickysaurus</span>",
      primaryGroup: [Object],
      secondaryGroups: [Array],
      email: 'mike.watling@nexusmods.com',
      joined: '2016-01-13T19:30:29Z',
      registrationIpAddress: '77.103.140.244',
      warningPoints: 0,
      reputationPoints: 528,
      photoUrl: 'https://avatars.nexusmods.com/31179975/100',
      photoUrlIsDefault: false,
      coverPhotoUrl: 'https://forums.nexusmods.com/uploads/monthly_2025_03/bg.png.53402e340adbf00338bc645f914f966e.png',
      profileUrl: 'https://forums.nexusmods.com/profile/31179975-pickysaurus/',
      validating: false,
      posts: 16848,
      lastActivity: '2025-04-10T09:48:25Z',
      lastVisit: '2025-04-09T19:42:36Z',
      lastPost: '2025-04-10T09:50:21Z',
      birthday: null,
      profileViews: 113322,
      customFields: [Object],
      rank: [Object],
      achievements_points: 116216,
      allowAdminEmails: false,
      completed: true
    },
    date: '2025-04-10T09:50:21Z',
    content: '<p>\n\ttest post\n</p>\n',
    hidden: false,
    url: 'https://forums.nexusmods.com/topic/13511151-example-thread/?do=findComment&comment=130502932',
    reactions: []
  }

*/