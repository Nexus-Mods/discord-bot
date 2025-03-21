import { 
    Snowflake, CommandInteraction, Collection, 
    Client, ContextMenuCommandBuilder, SlashCommandBuilder, AutocompleteInteraction,
} from "discord.js";
import { GameFeedManager } from "../feeds/GameFeedManager";
import { NewsFeedManager } from "../feeds/NewsFeedManager";
import { GameListCache, TipCache } from "./util";
import { AutoModManager } from "../feeds/AutoModManager";
import { SubscriptionManger } from "../feeds/SubscriptionManager";

interface ClientExt extends Client {
    config?: any;
    commands?: Collection<any, any>;
    interactions?: Collection<any, any>;
    gameFeeds?: GameFeedManager;
    newsFeed?: NewsFeedManager;
    automod?: AutoModManager;
    subscriptions?: SubscriptionManger;
    updateInteractions?: (force?: boolean) => Promise<void>
    gamesList?: GameListCache;
    tipCache?: TipCache;
}

interface DiscordEventInterface {
    name: string;
    once: boolean;
    execute: (client: Client, ...args: any) => Promise<void> | void;
}

interface DiscordInteraction {
    command: SlashCommandBuilder | ContextMenuCommandBuilder;
    action: (client: Client, interact: CommandInteraction) => Promise<void>;
    public: boolean;
    guilds?: Snowflake[];
    permissions?: PermissionsExt[];
    // Optional to add aliases
    aliases?: string[];
    // Optional for autocomplete commands
    autocomplete?: (client: Client, interact: AutocompleteInteraction) => Promise<void>,
}

interface PermissionsExt {
    guild?: Snowflake;
    id: Snowflake;
    type: 'USER' | 'ROLE';
    permission: boolean;
}

export { DiscordEventInterface, DiscordInteraction, ClientExt };