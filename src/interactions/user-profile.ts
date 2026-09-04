import { type Client, type ContextMenuCommandInteraction, ContextMenuCommandBuilder, ApplicationCommandType, type CommandInteraction, type ContextMenuCommandType } from "discord.js";
import type { DiscordInteraction, ClientExt } from "../types/DiscordTypes.js";
import { getUserByDiscordId } from '../api/users.js';
import { userEmbed, userProfileEmbed } from '../lib/profile.js';
import { KnownDiscordServers} from "../api/util.js";
import type { Logger } from "../api/logger.js";
import type { DiscordBotUser } from "../api/DiscordBotUser.js";
import { botUser, notAllowed } from '../lib/profile.js';

const discordInteraction: DiscordInteraction = {
    command: new ContextMenuCommandBuilder()
    .setName('Profile - Nexus Mods')
    .setType(ApplicationCommandType.User as ContextMenuCommandType),
    public: true,
    guilds: [ KnownDiscordServers.BotDemo ],
    defer: 'ephemeral',
    action
}

async function action(client: Client, baseinteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseinteraction as any as ContextMenuCommandInteraction);
    const member = interaction.targetId;
    const guildMember = await interaction.guild?.members?.fetch(member).catch(() => undefined);
    if (!guildMember) return interaction.editReply('This user is no longer a member of this server.');

    if (client.user?.id === interaction.targetId) return interaction.editReply({ content: 'That\'s me!', embeds: [await userEmbed(botUser(client), client)] });

    try {
        const user: DiscordBotUser|undefined = await getUserByDiscordId(interaction.targetId);
        if (!user) return interaction.editReply('No matching linked accounts.');
        const isAdmin: boolean = (client as ClientExt).config?.ownerIDs?.includes(interaction.user.id) ?? false;
        const inGuild: boolean = !!interaction.guild
        const isMe: boolean = interaction.user.id === user.DiscordId;
        if (isAdmin || isMe || inGuild) return interaction.editReply({ embeds: [await userProfileEmbed(user, client)] });
            else {
                logger.info('Profile view not authorised', {requester: interaction.user.tag, target: user, isAdmin, isMe, inGuild});
                return interaction.editReply({ embeds: [ notAllowed(client) ] });
            }
    }
    catch(err) {
        logger.warn('Error showing user profile', err);
        throw err;
    }

}

export { discordInteraction };
