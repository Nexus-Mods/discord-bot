import { News, SavedNewsData } from '../types/feeds';
import { updateSavedNews, getSavedNews, ensureNewsDB } from '../api/bot-db';
import { ClientExt } from "../types/DiscordTypes";
import { EmbedBuilder, TextChannel, WebhookClient } from 'discord.js';
import { Logger, nexusModsTrackingUrl } from '../api/util';
import { DiscordBotUser, DummyNexusModsUser } from '../api/DiscordBotUser';
import { IGameStatic } from '../api/queries/other';

const pollTime = (1000*60*30)*1; //30 mins hour

export class NewsFeedManager {
    private static instance: NewsFeedManager;

    private LatestNews: SavedNewsData | undefined = undefined;
    private client: ClientExt;
    private updateTimer: NodeJS.Timeout | undefined;
    private logger: Logger

    static async getInstance(client: ClientExt, logger: Logger): Promise<NewsFeedManager> {
        if (!NewsFeedManager.instance) {
            await ensureNewsDB(logger);
            let saved = undefined;
            try {
                saved = await getSavedNews(logger);
            }
            catch(err) {
                logger.error('Error fetching news', (err as Error).message);
            }
            NewsFeedManager.instance = new NewsFeedManager(client, pollTime, logger, saved);
            // Only trigger the news check if we have set up polling.
            if (NewsFeedManager.instance.updateTimer) await NewsFeedManager.instance.postLatestNews();
        }
        
        return NewsFeedManager.instance;
    }

    private constructor(client: ClientExt, pollTime: number, logger: Logger, savedNews?: SavedNewsData) {
        // Save the client for later
        this.client = client;
        this.logger = logger;
        this.LatestNews = savedNews;
        if (client.shard) {
            const guild = client.guilds.cache.get(process.env['NEWS_WEBHOOK_GUILD']!);
            if (!guild) {
                this.logger.debug('News webhook guild not found shard cache. Will not send news from here.');
                return;
            }
        }
        
        // Set the update interval.
        this.updateTimer = setInterval(async () => {
            try {
                // this.checkNews()
                await this.postLatestNews();
            }
            catch(err) {
                this.logger.warn('Failed to check for latest news updates', err);
            }
        }, pollTime);
        logger.info('Initialised news feed, checking every 30mins.')
    }

    private async postLatestNews(domain?: string): Promise<EmbedBuilder> {
        if (this.client.shard) {
            if (!this.client.guilds.cache.has(process.env['NEWS_WEBHOOK_GUILD']!)) {
                this.logger.warn('News webhook guild not found shard cache. Attempting to pass request to the correct shard.');
                const otherShards = await this.client.shard.broadcastEval(async (client: ClientExt, { guildId }) => {
                    if (client.guilds.cache.has(guildId)) {
                        return client.newsFeed!.postLatestNews(domain);
                    }
                }, { context: { guildId: process.env['NEWS_WEBHOOK_GUILD']! } });
                const results = otherShards.filter((r: any) => r !== undefined);
                if (results.length) {
                    if (results.length > 1) this.logger.warn('Multiple shards returned results for news updates. This is unexpected.');
                    return new EmbedBuilder(results[0]);
                }
                else {
                    this.logger.warn('No other shards able to post news updates.')
                    throw new Error('No shards able to post news updates.');
                }
            }
        }

        const dummyUser = new DiscordBotUser(DummyNexusModsUser, this.logger);
        const stored: SavedNewsData | undefined = NewsFeedManager.instance.LatestNews;
        const game: IGameStatic | undefined = domain ? ((await this.client.gamesList?.getGames())?.find(g => g.domain_name === domain)) : undefined;

        try {
            const news = await dummyUser.NexusMods.API.v2.News(game?.id);
            if (stored?.title === news[0].title && stored?.date.getTime() === news[0].publishDate.getTime()) {
                this.logger.info('No news updates since last check.');
                return newsPostEmbed(news[0], game?.domain_name);
            }
            // We need to post a new article! Let's set up a webhook.
            const webhook_id: string | undefined = process.env['NEWS_WEBHOOK_ID'];
            const webhook_token: string | undefined = process.env['NEWS_WEBHOOK_TOKEN'];
            const webhook_guild: string | undefined = process.env['NEWS_WEBHOOK_GUILD'];
            const webhook_channel: string | undefined = process.env['NEWS_WEBHOOK_CHANNEL'];
            if (!webhook_id || !webhook_token || !webhook_guild || !webhook_channel) throw new Error('News Webhook ID or Token missing from the ENV file');

            const webhookClient = new WebhookClient({ id: webhook_id, token: webhook_token });

            const newsEmbed = newsPostEmbed(news[0], game?.domain_name);

            const whMessage = await webhookClient.send({ content: '-# <@&1116364961757790238> (You can toggle this role in <id:customize>)', embeds: [newsEmbed] });

            const guild = await this.client.guilds.fetch(webhook_guild);
            const channel = await guild.channels.fetch(webhook_channel);
            const message = await (channel as TextChannel).messages.fetch(whMessage.id);

            if (message.crosspostable) {
                await message.crosspost();
                this.logger.info('News crossposted');
            }
            else this.logger.warn('Could not crosspost news');

            // Update saved news.
            const latest: SavedNewsData = { title: news[0].title, date: news[0].publishDate, id: parseInt(news[0].id) };

            if (!domain) {
                // Only update the saved news if this wasn't run against a game domain!
                await updateSavedNews(this.logger, latest.title, latest.date, latest.id);
                this.LatestNews = latest;
            }           

            return newsEmbed;

        }
        catch(err) {
            this.logger.warn('Error posting latest news', err);
            throw err;
        }
    }

    async forceUpdate(domain?: string): Promise<EmbedBuilder> {
        clearInterval(NewsFeedManager.instance.updateTimer);
        NewsFeedManager.instance.updateTimer = setInterval(() => NewsFeedManager.instance.postLatestNews(), pollTime);
        // NewsFeedManager.instance.updateTimer = setInterval(() => NewsFeedManager.instance.checkNews(), pollTime);
        this.logger.info('Forced news feed update check', domain || 'all');
        // return NewsFeedManager.instance.checkNews(domain);
        return NewsFeedManager.instance.postLatestNews(domain);
    }
}

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