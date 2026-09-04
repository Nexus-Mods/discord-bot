import { type Client, SlashCommandBuilder, type ChatInputCommandInteraction, type CommandInteraction, PermissionFlagsBits } from "discord.js";
import type { DiscordInteraction } from "../types/DiscordTypes.js";
import { KnownDiscordServers } from "../api/util.js";
import type { InteractionContext } from '../lib/middleware.js';
import type { Logger } from "../api/logger.js";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('mytoken')
    .setDescription('Get access token.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    public: false,
    guilds: [
        KnownDiscordServers.BotDemo
    ],
    defer: 'ephemeral',
    requiresLink: true,
    action,
}

async function action(client: Client, baseInteraction: CommandInteraction, logger: Logger, ctx: InteractionContext): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    const userData = ctx.user!;
    try {
        return interaction.editReply({
            content: `OAuth Access Token`,
            files: [{ attachment: Buffer.from(userData.NexusMods.Token()?.access_token ?? 'No token', 'utf-8'), name: 'access_token.txt' }]
        });
    }
    catch(err) {
        return interaction.editReply('Error getting user data: '+(err as Error).message);
    }
    
}

export { discordInteraction };