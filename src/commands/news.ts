import { Message } from "discord.js";
import { ClientExt } from "../DiscordBot";

async function run(client: ClientExt, message: Message, args: string[]) {
    // Ignore anyone who isn't an owner.
    if (!client.config.owner.includes(message.author.id)) return;
}