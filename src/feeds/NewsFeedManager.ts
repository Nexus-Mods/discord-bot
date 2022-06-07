import { NewsArticle, SavedNewsData } from '../types/feeds';
import { updateSavedNews, getSavedNews, getAllServers } from '../api/bot-db';
import { ClientExt } from "../types/util";
import Parser = require('rss-parser');
import { MessageEmbed, Guild, GuildChannel, Snowflake, ThreadChannel } from 'discord.js';
import { BotServer } from '../types/servers';
import { logMessage } from '../api/util';
const parser = new Parser({
    customFields: {
        item:['nexusmods:plain_description'],
    }  
});

const pollTime = (1000*60*60)*3; //3 hours

export class NewsFeedManager {
    private static instance: NewsFeedManager;

    private LatestNews: {title: string, date: Date} | undefined = undefined;
    private client: ClientExt;
    private updateTimer: NodeJS.Timeout;

    static getInstance(client: ClientExt): NewsFeedManager {
        if (!NewsFeedManager.instance) {
            NewsFeedManager.instance = new NewsFeedManager(client);
        }

        return NewsFeedManager.instance;
    }

    private constructor(client: ClientExt) {
        // Save the client for later
        this.client = client;
        // Set the update interval.
        this.updateTimer = setInterval(() => {
            try {
                this.checkNews()
            }
            catch(err) {
                logMessage('Failed to check for latest news updates', err, true);
            }
        }, pollTime);
        this.getSaved()
            .then((latest) => {
                console.log(`${new Date().toLocaleString()} - Initialised news feed, checking every 3 hours.`);
                this.checkNews();
                this.LatestNews = latest;
            })
            .catch((err) => console.error('Error in NewsFeedManager contructor', err));
    }

    private async getSaved(): Promise<{title: string, date: Date}> {
        return await getSavedNews();
    }

    private async checkNews(domain?: string|null): Promise<MessageEmbed|SavedNewsData|undefined> {
        const dom: string = domain ? `${domain}/` : '';
        const url = `https://www.nexusmods.com/${dom}rss/news`;

        try {
            const allNews: any = await parser.parseURL(url);
            const latest: NewsArticle = allNews.items[0];
            const stored: SavedNewsData | undefined = NewsFeedManager.instance.LatestNews;

            if (stored && (stored.title === latest.title || stored.date === latest.date)) {
                logMessage('No news updates since last check.');
                return stored;
            };

            const post: MessageEmbed = buildEmbed(NewsFeedManager.instance.client, latest);
            let allServers = await getAllServers()
                .catch((err) => {
                    logMessage('Error getting servers to post news update.', err, true);
                    return Promise.reject(err);
                });
            if (!allServers) return;
            
            allServers = allServers.filter(server => server.channel_news !== undefined);


            logMessage(`Publishing news post ${latest.title} to ${allServers.length} servers.`);
            for (const server of allServers) {
                const guildId: Snowflake | undefined = (server as BotServer).id;
                const channelId: Snowflake | undefined = server.channel_news;
                const guild: Guild | undefined = channelId ? await NewsFeedManager.instance.client.guilds.fetch(guildId).catch(() => undefined) : undefined;
                if (!guild) continue;
                const channel: GuildChannel | ThreadChannel | null = channelId ? guild.channels.resolve(channelId) : null;
                if (!channel) continue;
                (channel as any).send({ embeds: [post] }).catch((err: any) => logMessage(`Failed to post news in ${guild?.name}.`, err, true));
            }

            if (!domain) {
                await updateSavedNews(latest).catch((err) => logMessage('Could not updated saved news', err.message, true))
                NewsFeedManager.instance.LatestNews = { title: latest.title, date: latest.pubDate };
            };

            return post;
        }
        catch(err) {
            logMessage('Error checking news', (err as Error) ? (err as Error).message : err);
            if ((err as Error) && (err as Error).message.includes('404')) return Promise.reject({ message: `404 Not Found - ${url}` });
            return Promise.reject(err);
        }
        

    }

    async forceUpdate(domain?: string|null): Promise<MessageEmbed|SavedNewsData|undefined> {
        clearInterval(NewsFeedManager.instance.updateTimer);
        NewsFeedManager.instance.updateTimer = setInterval(() => NewsFeedManager.instance.checkNews(), pollTime);
        logMessage('Forced news feed update check', domain || 'all');
        return NewsFeedManager.instance.checkNews(domain);
    }
}

function buildEmbed(client: ClientExt, news: NewsArticle): MessageEmbed {
    const embed = new MessageEmbed()
    .setTitle(decodeURI(news.title))
    .setURL(news.link)
    .setImage(news.enclosure?.url)
    .setDescription(`${decodeURI(news["nexusmods:plain_description"].substr(0, 250))}...`)
    .setFooter({text: `${news.categories.toString()} - ${news.author}`, iconURL: client.user?.avatarURL() || undefined })
    .setTimestamp(news.pubDate)
    .setColor(0xda8e35);
    return embed;
}