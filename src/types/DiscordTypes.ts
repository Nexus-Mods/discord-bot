import type { Snowflake, CommandInteraction, Collection, Client, ContextMenuCommandBuilder, SlashCommandBuilder, AutocompleteInteraction } from "discord.js";
import type { NewsFeedManager } from "../feeds/NewsFeedManager.js";
import type { GameListCache, TipCache } from "./util.js";
import type { SubscriptionManger } from "../feeds/SubscriptionManager.js";
import type { Logger } from "../api/util.js";
import type { DeferOption, InteractionContext } from "../lib/middleware.js";

/**
 * Runtime configuration hung off the client. Was `config: any`, which is how
 * whois.ts came to read `config.ownerID` while the field is `ownerIDs` - a silent
 * undefined rather than a compile error (B16).
 */
interface BotConfig {
    testing: boolean;
    ownerIDs: Snowflake[];
}

interface ClientExt extends Client {
    config?: BotConfig;
    commands?: Collection<any, any>;
    interactions?: Collection<any, any>;
    newsFeed?: NewsFeedManager;
    subscriptions?: SubscriptionManger;
    updateInteractions?: (force?: boolean) => Promise<void>
    gamesList?: GameListCache;
    tipCache?: TipCache;
}

interface DiscordEventInterface {
    name: string;
    once: boolean;
    execute: (client: Client, logger: Logger, ...args: any) => Promise<void> | void;
}

interface DiscordInteraction {
    command: SlashCommandBuilder | ContextMenuCommandBuilder;
    /**
     * The fourth argument carries whatever the middleware resolved. It is optional,
     * so a command that has not opted in keeps its existing three-parameter shape.
     */
    action: (client: Client, interact: CommandInteraction, logger: Logger, ctx: InteractionContext) => Promise<void>;
    public: boolean;
    guilds?: Snowflake[];

    /**
     * Defer the reply before the action runs. Omit to defer inside the action, as
     * every command did before 4.0.0.
     */
    defer?: DeferOption;
    /**
     * Refuse the command unless the caller has a linked Nexus Mods account, and pass
     * the resolved account to the action as ctx.user.
     */
    requiresLink?: boolean;
    /** Guild permissions the caller must hold, e.g. PermissionFlagsBits.ManageGuild. */
    requiredPermissions?: bigint[];

    // Optional to add aliases
    aliases?: string[];
    // Optional for autocomplete commands
    autocomplete?: (client: Client, interact: AutocompleteInteraction, logger: Logger) => Promise<void>,
}

export { DiscordEventInterface, DiscordInteraction, ClientExt };
export type { BotConfig };