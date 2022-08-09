import { Client } from "discord.js";

interface DiscordEventInterface {
    name: string;
    once: boolean;
    execute: (client: Client, ...args: any) => Promise<void> | void;
}

export { DiscordEventInterface };