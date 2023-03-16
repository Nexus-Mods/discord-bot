import { 
    Snowflake, CommandInteraction, Collection, 
    Client, ContextMenuCommandBuilder, SlashCommandBuilder, AutocompleteInteraction,
} from "discord.js";
import { GameFeedManager } from "../feeds/GameFeedManager";
import { ModFeedManager } from "../feeds/ModFeedManager";
import { NewsFeedManager } from "../feeds/NewsFeedManager";

interface ClientExt extends Client {
    config?: any;
    commands?: Collection<any, any>;
    interactions?: Collection<any, any>;
    gameFeeds?: GameFeedManager;
    modFeeds?: ModFeedManager;
    newsFeed?: NewsFeedManager;
    updateInteractions?: (force?: boolean) => Promise<void>
}

interface DiscordEventInterface {
    name: string;
    once: boolean;
    execute: (client: Client, ...args: any) => Promise<void> | void;
}

// export type DiscordInteractionType = 
// | UserContextMenuCommandInteraction 
// | MessageContextMenuCommandInteraction 
// | CommandInteraction;

interface DiscordInteraction {
    command: SlashCommandBuilder | ContextMenuCommandBuilder;
    action: (client: Client, interact: CommandInteraction) => Promise<void>;
    public: boolean;
    guilds?: Snowflake[];
    permissions?: PermissionsExt[];
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