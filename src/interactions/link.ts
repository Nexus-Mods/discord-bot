import { 
    CommandInteraction, Snowflake, EmbedBuilder, Client, SlashCommandBuilder, PermissionFlagsBits, 
    ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle
} from "discord.js";
import { DiscordInteraction } from "../types/DiscordTypes.js";
import { getUserByDiscordId } from '../api/bot-db.js';
import { KnownDiscordServers, Logger } from '../api/util.js';
import { DiscordBotUser } from "../api/DiscordBotUser.js";
import { unlinkUrl } from '../server/auth.js';
import { NEXUS_ORANGE, apiLinkFooter } from '../lib/embeds.js';

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
    defer: 'ephemeral',
    action
}

async function action(client: Client, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    const discordId: Snowflake = interaction.user.id;
    try {
        const userData: DiscordBotUser|undefined = await getUserByDiscordId(discordId);
        const response: { embeds: EmbedBuilder[], components: ActionRowBuilder<ButtonBuilder>[] } = await linkingEmbed(userData, discordId, client, logger);
        return interaction.editReply(response).catch(undefined);
    }
    catch(err) {
        logger.warn('Error in /link command', err);
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

const linkingEmbed = async (user: DiscordBotUser|undefined, discordId: string, client: Client, logger: Logger): Promise<{ embeds: EmbedBuilder[], components: ActionRowBuilder<ButtonBuilder>[] }> => {
    const components = [];
    const embed = new EmbedBuilder()
    .setColor(NEXUS_ORANGE)
    .addFields([
        {
            name: 'Linked Roles',
            value: 'You can claim your roles using the "Linked Roles" option in the server drop-down menu.'
        }
    ])
    .setFooter(apiLinkFooter(client));
    if (user) {
        try {
            await user.NexusMods.Auth();
            // logMessage('Authorisation success for /link', { user: user.NexusModsUsername, discord: user.DiscordId });
        }
        catch(err) {
            logger.warn('Authorisation failed for /link', { user: user.NexusModsUsername, discord: user.DiscordId, err });
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
            .setURL(unlinkUrl(discordId))
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
