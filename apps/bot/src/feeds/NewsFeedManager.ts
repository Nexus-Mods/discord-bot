import type { News, SavedNewsData } from '../types/feeds.js';
import { getSavedNews, updateSavedNews } from '../api/news.js';
import type { ClientExt } from "../types/DiscordTypes.js";
import { EmbedBuilder, type TextChannel, WebhookClient } from 'discord.js';
import { nexusModsTrackingUrl, baseheader } from '../api/util.js';
import type { Logger } from "@nexusmods/core/logger.js";
import type { IGameStatic } from '../api/queries/other.js';
import { v2 } from '../api/queries/all.js';
import { NEXUS_ORANGE } from '../lib/embeds.js';
import { voidAsync } from '../lib/async.js';
import { ownsGuild, postNewsOnOwningShard, requireShard, shardIdForGuild } from '../lib/sharding.js';

const pollTime = (1000*60*30)*1; //30 mins

export class NewsFeedManager {
    private static instance: NewsFeedManager;

    private LatestNews: SavedNewsData | undefined = undefined;
    private client: ClientExt;
    private updateTimer: NodeJS.Timeout | undefined;
    private logger: Logger;

    private webhook_id: string | undefined = process.env['NEWS_WEBHOOK_ID'];
    private webhook_token: string | undefined = process.env['NEWS_WEBHOOK_TOKEN'];
    private webhook_guild: string | undefined = process.env['NEWS_WEBHOOK_GUILD'];
    private webhook_channel: string | undefined = process.env['NEWS_WEBHOOK_CHANNEL'];

    private API ={
        v2: {
            News: async (gameId?: number) => v2.news(baseheader, this.logger, gameId),
        }
    }

    static async getInstance(client: ClientExt, logger: Logger): Promise<NewsFeedManager> {
        if (!NewsFeedManager.instance) {
            let saved = undefined;
            if (NewsFeedManager.isInstanceForShard(client)) {
                try {
                    saved = await getSavedNews(logger);
                }
                catch(err) {
                    logger.error('Error fetching news', (err as Error).message);
                }
            }
            NewsFeedManager.instance = new NewsFeedManager(client, pollTime, logger, saved);
        }
        
        return NewsFeedManager.instance;
    }

    private static isInstanceForShard = (client: ClientExt): boolean =>
        ownsGuild(client, process.env['NEWS_WEBHOOK_GUILD']!);

    private constructor(client: ClientExt, pollTime: number, logger: Logger, savedNews?: SavedNewsData) {
        // Save the client for later
        this.client = client;
        this.logger = logger;
        this.LatestNews = savedNews;

        // The guard was inverted: the timer was installed everywhere EXCEPT the shard
        // holding the news guild, so every post round-tripped through broadcastEval.
        if (!NewsFeedManager.isInstanceForShard(client)) {
            this.logger.debug('News webhook guild not found in this shard. Will not send news from here.');
            return;
        }
        
        // Set the update interval.
        this.updateTimer = setInterval(
            voidAsync(this.logger, 'news feed poll', () => this.postLatestNews()),
            pollTime,
        );
        logger.info('Initialised news feed, checking every 30mins.')
    }

    /**
     * Entry point for a news post another shard could not make itself, because this
     * process is the one holding the news guild. Public for the same reason as
     * SubscriptionManger.handleRefreshRequest - it is invoked across a process
     * boundary - while postLatestNews stays private.
     */
    public async handleNewsRequest(domain?: string): Promise<EmbedBuilder> {
        return this.postLatestNews(domain);
    }

    private async postLatestNews(domain?: string): Promise<EmbedBuilder> {
        if (!NewsFeedManager.isInstanceForShard(this.client)) {
            const correctShard = shardIdForGuild(this.client, process.env['NEWS_WEBHOOK_GUILD']!);
            this.logger.warn('News webhook guild not handled by this shard. Passing the request to the correct shard.', correctShard);
            if (requireShard(this.client).ids[0] === correctShard) {
                throw new Error('This shard owns the news guild but isInstanceForShard disagrees.');
            }
            const embed = await postNewsOnOwningShard(this.client, correctShard, domain);
            if (!embed) {
                this.logger.warn('No other shards able to post news updates.');
                throw new Error('No shards able to post news updates.');
            }
            return new EmbedBuilder(embed);
        }

        const stored: SavedNewsData | undefined = NewsFeedManager.instance.LatestNews;
        const game: IGameStatic | undefined = domain ? ((await this.client.gamesList?.getGames())?.find(g => g.domain_name === domain)) : undefined;

        try {
            const news = await this.API.v2.News(game?.id);
            if (news.length === 0) throw new Error('API returned no news articles, check the logs for further details.');
            if (stored?.title === news[0].title && stored?.date.getTime() === news[0].publishDate.getTime()) {
                this.logger.info('No news updates since last check.');
                return newsPostEmbed(news[0], game?.domain_name);
            }
            // We need to post a new article! Let's set up a webhook.
            if (!this.webhook_id || !this.webhook_token || !this.webhook_guild || !this.webhook_channel) throw new Error('News Webhook ID or Token missing from the ENV file');

            const webhookClient = new WebhookClient({ id: this.webhook_id, token: this.webhook_token });

            const newsEmbed = newsPostEmbed(news[0], game?.domain_name);

            const whMessage = await webhookClient.send({ content: '-# <@&1116364961757790238> (You can toggle this role in <id:customize>)', embeds: [newsEmbed] });

            const guild = await this.client.guilds.fetch(this.webhook_guild);
            const channel = await guild.channels.fetch(this.webhook_channel);
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
        NewsFeedManager.instance.updateTimer = setInterval(
            voidAsync(this.logger, 'news feed poll', () => NewsFeedManager.instance.postLatestNews()),
            pollTime,
        );
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
    .setColor(NEXUS_ORANGE);
    return embed;
}