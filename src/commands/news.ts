import { Message } from "discord.js";
import { ClientExt } from "../DiscordBot";
import { NewsFeedManager } from "../feeds/NewsFeedManager";

async function run(client: ClientExt, message: Message, args: string[]) {
    // Ignore anyone who isn't an owner.
    if (message.guild || !client.config.ownerID?.includes(message.author.id)) return;

    const reply: Message|undefined = await message.channel.send('Updating news feed...').catch(() => undefined);
    const domain: string|undefined = args.length ? args[0] : undefined;
    const newsInst: NewsFeedManager = NewsFeedManager.getInstance(client);
    if (reply) newsInst.forceUpdate(reply, domain);
    else message.reply('Failed to update news.').catch(console.error);
}

export { run };