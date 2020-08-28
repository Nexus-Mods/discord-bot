import { NewsArticle } from '../types/feeds';
import { updateSavedNews, getSavedNews, getAllServers } from '../api/bot-db';
import { ClientExt } from '../DiscordBot';
import Parser = require('rss-parser');
import { Message, MessageEmbed, Guild, GuildChannel, TextChannel } from 'discord.js';
import { BotServer } from '../types/servers';
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
        this.updateTimer = setInterval(() => this.checkNews(), pollTime);
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

    private async checkNews(domain?: string): Promise<void> {
        const dom: string = domain ? `${domain}/` : '';
        const url = `https://www.nexusmods.com/${dom}rss/news`;

        try {
            const allNews: any = await parser.parseURL(url);
            const latest: NewsArticle = allNews.items[0];
            const stored: {title: string, date: Date} | undefined = NewsFeedManager.instance.LatestNews;

            if (stored && (stored.title === latest.title || stored.date === latest.date)) return console.log(`${new Date().toLocaleString()} - No news updates since last check.`);

            const post: MessageEmbed = buildEmbed(NewsFeedManager.instance.client, latest);
            let allServers = await getAllServers()
                .catch((err) => {
                    console.log('Error getting servers to post news update.', err);
                    return Promise.reject(err);
                });
            if (!allServers) return;
            
            allServers = allServers.filter(server => server.channel_news !== undefined);


            console.log(`${new Date().toLocaleString()} - Publishing news post ${latest.title} to ${allServers.length} servers.`);
            for (const server of allServers) {
                const guildId: string | undefined = (server as BotServer).id;
                const channelId: string | undefined = server.channel_news;
                const guild: Guild | undefined = channelId ? await NewsFeedManager.instance.client.guilds.fetch(guildId).catch(() => undefined) : undefined;
                if (!guild) continue;
                const channel: GuildChannel | null = channelId ? guild.channels.resolve(channelId) : null;
                if (!channel) continue;
                (channel as TextChannel).send(post).catch((err) => console.log(`${new Date().toLocaleString()} - Failed to post news in ${guild}.`, err));
            }

            if (!domain) {
                await updateSavedNews(latest).catch((err) => console.error('Could not updated saved news', err.message))
                NewsFeedManager.instance.LatestNews = { title: latest.title, date: latest.pubDate };
            };
        }
        catch(err) {
            console.log('Error checking news', err);
            Promise.reject(err);
        }
        

    }

    async forceUpdate(message: Message, domain?: string): Promise<void> {
        clearInterval(NewsFeedManager.instance.updateTimer);
        NewsFeedManager.instance.updateTimer = setInterval(() => NewsFeedManager.instance.checkNews(), pollTime);
        return NewsFeedManager.instance.checkNews(domain)
            .then(() => { 
                message.channel.send('News updated successfully');
            })
            .catch((err: Error) => { 
                message.channel.send('Error updating news'+err.message);
                return;
            });
    }
}

function buildEmbed(client: ClientExt, news: NewsArticle): MessageEmbed {
    const embed = new MessageEmbed()
    .setTitle(news.title)
    .setURL(news.link)
    .setImage(news.enclosure?.url)
    .setDescription(`${news["nexusmods:plain_description"].substr(0, 250)}...`)
    .setFooter(`${news.categories.toString()} - ${news.author}`,client.user?.avatarURL() || undefined)
    .setTimestamp(news.pubDate)
    .setColor(0xda8e35);
    return embed;
}