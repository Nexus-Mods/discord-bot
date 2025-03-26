import { 
    CommandInteraction, Snowflake, EmbedBuilder, Client, SlashCommandBuilder, PermissionFlagsBits, 
    ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle 
} from "discord.js";
import { DiscordInteraction } from "../types/DiscordTypes";
import { getUserByDiscordId } from '../api/bot-db';
import { KnownDiscordServers, logMessage } from '../api/util';
import { DiscordBotUser } from "../api/DiscordBotUser";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Nexus Mods account to Discord.')
    .setDMPermission(true)
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),
    public: true,
    guilds: [
        KnownDiscordServers.BotDemo
    ],
    action
}

async function action(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    const discordId: Snowflake = interaction.user.id;
    await interaction.deferReply({ephemeral: true}).catch(err => { throw err });;
    try {
        let userData: DiscordBotUser|undefined = await getUserByDiscordId(discordId);
        const response: { embeds: EmbedBuilder[], components: ActionRowBuilder<ButtonBuilder>[] } = await linkingEmbed(userData, discordId, client);
        return interaction.editReply(response).catch(undefined);
    }
    catch(err) {
        logMessage('Error in /link command', err, true);
        return interaction.editReply('Unexpected error! '+(err as Error).message);
    }

}

const linkButton = (discordId: string) => new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setLabel('Link Account')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discordbot.nexusmods.com/linked-role?id=${discordId}`)
        );

const linkingEmbed = async (user: DiscordBotUser|undefined, discordId: string, client: Client): Promise<{ embeds: EmbedBuilder[], components: ActionRowBuilder<ButtonBuilder>[] }> => {
    let components = [];
    const embed = new EmbedBuilder()
    .setColor(0xda8e35)
    .addFields([
        {
            name: 'Linked Roles',
            value: 'You can claim your roles using the "Linked Roles" option in the server drop-down menu.'
        }
    ])
    .setFooter({ text: `Nexus Mods API Link`, iconURL: client.user?.avatarURL() || '' });
    if (!!user) {
        try {
            await user.NexusMods.Auth();
            // logMessage('Authorisation success for /link', { user: user.NexusModsUsername, discord: user.DiscordId });
        }
        catch(err) {
            logMessage('Authorisation failed for /link', { user: user.NexusModsUsername, discord: user.DiscordId, err });
            embed.setTitle('Re-authorise your Discord account')
            .setDescription('Your Nexus Mods authorisation has expired, use the button below to re-link');
            return { embeds: [embed], components: [ linkButton(discordId) as ActionRowBuilder<ButtonBuilder> ] };
        }
        embed.setTitle(`Your Discord account is linked with ${user.NexusModsUsername}`)
        .setDescription('With your account linked you can now use all the features of the Discord bot!')
        .setAuthor({ name: user.NexusModsUsername, url: `https://nexusmods.com/users/${user.NexusModsId}`, iconURL: user.NexusModsAvatar });

        const unlinkButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setLabel('Unlink Account')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discordbot.nexusmods.com/revoke?id=${discordId}`)
        );
        components.push(unlinkButton);

    }
    else {
        embed.setTitle('Connect your Discord account')
        .setURL(`https://discordbot.nexusmods.com/linked-role?id=${discordId}`)
        .setDescription(`Linking your account will allow you to use Game Feeds, Search and more!`)

        components.push(linkButton(discordId));
    }

    return { embeds : [embed], components: (components as ActionRowBuilder<ButtonBuilder>[] ) };
}

export { discordInteraction };
