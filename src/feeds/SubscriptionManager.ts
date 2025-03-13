import { GameFeed } from '../types/feeds';
import { getAllGameFeeds, getGameFeed, createGameFeed, deleteGameFeed, getUserByDiscordId, getUserByNexusModsName, updateGameFeed } from '../api/bot-db';
import { ClientExt } from "../types/DiscordTypes";
import { IUpdateEntry, IChangelogs } from '@nexusmods/nexus-api';
import { User, Guild, Snowflake, TextChannel, WebhookClient, GuildMember, EmbedBuilder, Client, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, NewsChannel, GuildBasedChannel } from 'discord.js';
import { logMessage, nexusModsTrackingUrl } from '../api/util';
import { NexusAPIServerError } from '../types/util';
import { DiscordBotUser } from '../api/DiscordBotUser';
import { IMod } from '../api/queries/v2';
import { IGameStatic } from '../api/queries/other';
import { SubscribedChannel } from '../types/subscriptions';
import { ensureSubscriptionsDB, getSubscribedChannels } from '../api/subscriptions';

// const pollTime: number = (1000*60*10); //10 mins

export class SubscriptionManger {
    private static instance: SubscriptionManger;
    private client: ClientExt;
    private updateTimer: NodeJS.Timeout;
    private initialised: boolean = false;
    private pollTime: number; //10 mins
    private channels: SubscribedChannel[]

    private constructor(client: ClientExt, pollTime: number, channels: SubscribedChannel[]) {
        // Save the client for later
        this.client = client;
        this.pollTime = pollTime;
        this.channels = channels;
        // Set the update interval.
        this.updateTimer = setInterval(this.updateSubscriptions, pollTime);
    }

    static async getInstance(client: ClientExt, pollTime: number = (1000*60*10)): Promise<SubscriptionManger> {
        if (!SubscriptionManger.instance) {
            await SubscriptionManger.initialiseInstance(client, pollTime);
        }
        return SubscriptionManger.instance;
    }

    private static async initialiseInstance(client: ClientExt, pollTime: number): Promise<void> {
        // Set up any missing tables
        try {
            await ensureSubscriptionsDB();
            const channels = await getSubscribedChannels();
            SubscriptionManger.instance = new SubscriptionManger(client, pollTime, channels);
        }
        catch(err) {
            throw err;
        }
    }

    private async updateSubscriptions() {
        // Update the channels
    }
}