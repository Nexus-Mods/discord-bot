import type { DiscordEventInterface } from "../types/DiscordTypes.js";
import type { Message, TextChannel } from 'discord.js';

const main: DiscordEventInterface = {
    name: 'messageCreate',
    once: false,
    async execute(client, logger, message: Message) {
        const WATCHED_CHANNEL_ID = process.env['WATCHED_CHANNEL_ID'];
        if (!WATCHED_CHANNEL_ID) return;
        if (message.channel.id !== WATCHED_CHANNEL_ID) return;
        if (message.author.bot) return;
        if (!message.member?.bannable) return logger.info("Unbannable user posted in bait channel", message.member?.displayName);

        try {
            const dmChannel = await message.member.createDM(true);
            await dmChannel.send("You have been banned from the Nexus Mods Discord server as your Discord account was posting spam or you posted in a prohibited channel. Contact support@nexusmods.com to appeal this ban.");
            logger.info(`Successfully DMed ${message.author.tag} to inform them of the ban.`);
        }
        catch(e: unknown) {
            logger.warn(`Failed to inform user of ban ${message.author.tag}:`, e);
        }

        try {
            // Wait 1 second to try and prevent Discord race conditions preventing the message from being removed. 
            await new Promise<void>((resolve) => setTimeout(resolve, 1000));
            await message.member.ban({
                reason: 'Posting in restricted channel - likely compromised account',
                deleteMessageSeconds: 3600
            });
            logger.info(`Banned ${message.author.tag} (${message.author.id})`);
        }
        catch(err: unknown) {
            logger.warn(`Failed to ban ${message.author.tag}:`, err);
        }

        try {
            const baitChannel = await client.channels.fetch(WATCHED_CHANNEL_ID);
            if (baitChannel) {
                const channel = await baitChannel.fetch() as TextChannel
                const currentMessages = await channel.messages.fetch({ limit: 20 });
                const latestBotMessage = currentMessages.find((m) => m.author.id === client.user?.id);
                if (latestBotMessage && latestBotMessage.editable) {
                    const prevCount = latestBotMessage.content.replace(' account(s) banned for spam.', ''); // Should give a number;
                    const newCount = Number(prevCount.trim()) + 1;
                    await latestBotMessage.edit(`${newCount.toLocaleString()} account(s) banned for spam.`);
                }
                else await channel.send(`1 account(s) banned for spam.`);
            }
        }
        catch(e: unknown) {
            logger.warn(`Failed to update banned spam accounts message`, e);
        }
    }
};

export default main;