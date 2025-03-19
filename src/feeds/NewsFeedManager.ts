import { News, NewsArticle, SavedNewsData } from '../types/feeds';
import { updateSavedNews, getSavedNews, ensureNewsDB } from '../api/bot-db';
import { ClientExt } from "../types/DiscordTypes";
// import Parser = require('rss-parser');
import { EmbedBuilder, TextChannel, WebhookClient } from 'discord.js';
import { logMessage, nexusModsTrackingUrl } from '../api/util';
import { DiscordBotUser, DummyNexusModsUser } from '../api/DiscordBotUser';
import { IGameStatic } from '../api/queries/other';

// const parser = new Parser<Parser.Output<NewsArticle>, { "nexusmods:plain_description": string }>({
//     customFields: {
//         item:['nexusmods:plain_description'],
//     }  
// });

const pollTime = (1000*60*60)*1; //1 hour

export class NewsFeedManager {
    private static instance: NewsFeedManager;

    private LatestNews: SavedNewsData | undefined = undefined;
    private client: ClientExt;
    private updateTimer: NodeJS.Timeout;

    static async getInstance(client: ClientExt): Promise<NewsFeedManager> {
        if (!NewsFeedManager.instance) {
            await ensureNewsDB();
            let saved = undefined;
            try {
                saved = await getSavedNews();
            }
            catch(err) {
                logMessage('Error fetching news', (err as Error).message, true);
            }
            logMessage('Initialised news feed, checking every hour.')
            NewsFeedManager.instance = new NewsFeedManager(client, saved);
            await NewsFeedManager.instance.postLatestNews();
        }
        
        return NewsFeedManager.instance;
    }

    private constructor(client: ClientExt, savedNews?: SavedNewsData) {
        // Save the client for later
        this.client = client;
        // Set the update interval.
        this.updateTimer = setInterval(async () => {
            try {
                // this.checkNews()
                await this.postLatestNews();
            }
            catch(err) {
                logMessage('Failed to check for latest news updates', err, true);
            }
        }, pollTime);
        this.LatestNews = savedNews;
    }

    private async postLatestNews(domain?: string): Promise<EmbedBuilder> {
        const dummyUser = new DiscordBotUser(DummyNexusModsUser);
        const stored: SavedNewsData | undefined = NewsFeedManager.instance.LatestNews;
        const game: IGameStatic | undefined = domain ? ((await this.client.gamesList?.getGames())?.find(g => g.domain_name === domain)) : undefined;

        try {
            const news = await dummyUser.NexusMods.API.v2.News(game?.id);
            if (stored?.title === news[0].title && stored?.date.getTime() === news[0].publishDate.getTime()) {
                logMessage('No news updates since last check.');
                return newsPostEmbed(news[0], game?.domain_name);
            }
            else {
                logMessage('News data did not match', { old: { title: stored?.title, date: stored?.date }, new: { title: news[0].title, date: news[0].publishDate } });
                // return newsPostEmbed(news[0], game?.domain_name);
            }
            // We need to post a new article! Let's set up a webhook.
            const webhook_id: string | undefined = process.env['NEWS_WEBHOOK_ID'];
            const webhook_token: string | undefined = process.env['NEWS_WEBHOOK_TOKEN'];
            const webhook_guild: string | undefined = process.env['NEWS_WEBHOOK_GUILD'];
            const webhook_channel: string | undefined = process.env['NEWS_WEBHOOK_CHANNEL'];
            if (!webhook_id || !webhook_token || !webhook_guild || !webhook_channel) throw new Error('News Webhook ID or Token missing from the ENV file');

            const webhookClient = new WebhookClient({ id: webhook_id, token: webhook_token });

            const newsEmbed = newsPostEmbed(news[0], game?.domain_name);

            // const whMessage = await webhookClient.send({ content: '-# <@&1116364961757790238> (You can toggle this role in <id:customize>)', embeds: [newsEmbed] });
            const whMessage = await webhookClient.send({ embeds: [newsEmbed] });

            const guild = await this.client.guilds.fetch(webhook_guild);
            const channel = await guild.channels.fetch(webhook_channel);
            const message = await (channel as TextChannel).messages.fetch(whMessage.id);

            if (message.crosspostable) {
                await message.crosspost();
                logMessage('News crossposted');
            }
            else logMessage('Could not crosspost news');

            // Update saved news.
            const latest: SavedNewsData = { title: news[0].title, date: news[0].publishDate, id: parseInt(news[0].id) };

            await updateSavedNews(latest.title, latest.date, latest.id);
            this.LatestNews = latest

            return newsEmbed;

        }
        catch(err) {
            logMessage('Error posting latest news', err, true);
            throw err;
        }
    }

    // private async checkNews(domain?: string|null): Promise<EmbedBuilder|SavedNewsData|undefined> {
    //     const dom: string = domain ? `${domain}/` : '';
    //     const url = `https://www.nexusmods.com/${dom}rss/news`;

    //     try {
    //         const allNews: Parser.Output<NewsArticle> =  await parser.parseURL(url); //await parseFeed(url);
    //         const latest: NewsArticle = allNews.items[0];
    //         const stored: SavedNewsData | undefined = NewsFeedManager.instance.LatestNews;

    //         if (stored && (stored.title === latest.title || stored.date === latest.date)) {
    //             logMessage('No news updates since last check.');
    //             return stored;
    //         };

    //         const post: EmbedBuilder = buildEmbed(NewsFeedManager.instance.client, latest);
    //         let allServers = await getAllServers()
    //             .catch((err) => {
    //                 logMessage('Error getting servers to post news update.', err, true);
    //                 return Promise.reject(err);
    //             });
    //         if (!allServers) return;
            
    //         allServers = allServers.filter(server => server.channel_news !== undefined);


    //         logMessage(`Publishing news post ${latest.title} to ${allServers.length} servers.`);
    //         for (const server of allServers) {
    //             const guildId: Snowflake | undefined = (server as BotServer).id;
    //             const channelId: Snowflake | undefined = server.channel_news;
    //             const guild: Guild | undefined = channelId ? await NewsFeedManager.instance.client.guilds.fetch(guildId).catch(() => undefined) : undefined;
    //             if (!guild) continue;
    //             const channel: GuildChannel | ThreadChannel | null = channelId ? guild.channels.resolve(channelId) : null;
    //             if (!channel) continue;
    //             try {
    //                 const message = await (channel as TextChannel).send({ embeds: [post] });
    //                 message.crosspostable && !domain ? await message.crosspost() : null;
    //             }
    //             catch(err) {
    //                 logMessage(`Failed to post news in ${guild?.name}.`, err, true)
    //             };
    //         }

    //         if (!domain) {
    //             await updateSavedNews(latest.title, latest.date, 0).catch((err) => logMessage('Could not updated saved news', err.message, true))
    //             NewsFeedManager.instance.LatestNews = { title: latest.title, date: latest.pubDate, id: 0 };
    //         };

    //         return post;
    //     }
    //     catch(err) {
    //         logMessage('Error checking news', (err as Error) ? (err as Error).message : err);
    //         if ((err as Error) && (err as Error).message.includes('404')) return Promise.reject({ message: `404 Not Found - ${url}` });
    //         // return Promise.reject(err);
    //     }
        

    // }

    async forceUpdate(domain?: string): Promise<EmbedBuilder|SavedNewsData|undefined> {
        clearInterval(NewsFeedManager.instance.updateTimer);
        NewsFeedManager.instance.updateTimer = setInterval(() => NewsFeedManager.instance.postLatestNews(), pollTime);
        // NewsFeedManager.instance.updateTimer = setInterval(() => NewsFeedManager.instance.checkNews(), pollTime);
        logMessage('Forced news feed update check', domain || 'all');
        // return NewsFeedManager.instance.checkNews(domain);
        return NewsFeedManager.instance.postLatestNews(domain);
    }
}

// function buildEmbed(client: ClientExt, news: NewsArticle): EmbedBuilder {
//     const embed = new EmbedBuilder()
//     .setTitle(decodeURI(news.title).replace(/\&amp;/g,'&'))
//     .setURL(nexusModsTrackingUrl(news.link, 'newsfeed'))
//     .setImage(news.enclosure?.url)
//     .setDescription(`${decodeURI(news["nexusmods:plain_description"].substr(0, 250))}...`)
//     .setFooter({text: `${news.categories.toString()} - ${news.author}`, iconURL: client.user?.avatarURL() || undefined })
//     .setTimestamp(new Date(news.pubDate))
//     .setColor(0xda8e35);
//     return embed;
// }

function newsPostEmbed(news: News, gameDomain?: string) {
    const embed = new EmbedBuilder()
    .setTitle(news.title)
    .setThumbnail('https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1741874175-1830228471.png')
    .setURL(nexusModsTrackingUrl(news.url(gameDomain), 'newsfeed'))
    .setImage(news.imageUrl)
    .setDescription(news.summary.substring(0, 250)+'...')
    .setFooter({text: `${news.author.name} • ${news.newsCategory.name}`, iconURL: news.author.avatar })
    .setTimestamp(news.publishDate)
    .setColor(0xda8e35);
    return embed;
}