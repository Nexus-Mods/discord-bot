import { Client, Snowflake, EmbedBuilder, ContextMenuCommandInteraction, ContextMenuCommandBuilder, ApplicationCommandType, CommandInteraction, ContextMenuCommandType, MessageFlags } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
import { getUserByDiscordId, userProfileEmbed, userEmbed } from '../api/bot-db';
import { KnownDiscordServers, Logger } from "../api/util";
import { NexusUser } from "../types/users";
import { DiscordBotUser } from "../api/DiscordBotUser";

const discordInteraction: DiscordInteraction = {
    command: new ContextMenuCommandBuilder()
    .setName('Profile - Nexus Mods')
    .setType(ApplicationCommandType.User as ContextMenuCommandType),
    public: true,
    guilds: [ KnownDiscordServers.BotDemo ],
    action
}

async function action(client: Client, baseinteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseinteraction as any as ContextMenuCommandInteraction);
    await interaction.deferReply( { flags: MessageFlags.Ephemeral });
    const member = interaction.targetId;
    const guildMember = await interaction.guild?.members?.fetch(member).catch(() => undefined);
    if (!guildMember) return interaction.editReply('This user is no longer a member of this server.');

    if (client.user?.id === interaction.targetId) return interaction.editReply({ content: 'That\'s me!', embeds: [await userEmbed(botUser(client), client)] });

    try {
        const user: DiscordBotUser|undefined = await getUserByDiscordId(interaction.targetId);
        if (!user) return interaction.editReply('No matching linked accounts.');
        const isAdmin: boolean = (client as ClientExt).config.ownerID?.includes(interaction.user.id);
        const inGuild: boolean = !!interaction.guild
        const isMe: boolean = interaction.user.id === user.DiscordId;
        if (isAdmin || isMe || inGuild) return interaction.editReply({ embeds: [await userProfileEmbed(user, client)] });
            else {
                logger.info('Profile view not authorised', {requester: interaction.user.tag, target: user, isAdmin, isMe, inGuild});
                return interaction.editReply({ embeds: [ notAllowed(client) ] });
            };
    }
    catch(err) {
        throw err;        
    }

}

const botUser = (client: Client): NexusUser => {
    const d_id: Snowflake = client.user?.id ? client.user?.id.toString() as Snowflake : '' as Snowflake;
    const avatar_url = client.user?.avatarURL() || '';
    return {
        d_id,
        id: 1234042,
        name: 'Nexus Mods Discord Bot',
        avatar_url,
        premium: false,
        supporter: false,
        lastupdate: new Date()
    }
}

const notAllowed = (client: Client): EmbedBuilder => {
    return new EmbedBuilder()
    .setTitle('⛔  Profile Unavailable')
    .setColor('#ff0000')
    .setDescription('The user you are looking for is not a member of this server.')
    .setFooter({ text: `Nexus Mods API Link`, iconURL: client.user?.avatarURL() || '' });
}

export { discordInteraction };