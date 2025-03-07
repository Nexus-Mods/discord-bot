import { AutocompleteInteraction, EmbedBuilder } from "discord.js";
import { ClientExt } from "../types/DiscordTypes";

export const logMessage  = (msg: string, obj?: any, error?: boolean) => {
    const message = `${new Date().toLocaleString()} - ${msg}`;
    error === true ? console.error(message, obj || '') : console.log(message, obj || '');
};

export async function autocompleteGameName(client: ClientExt, acInteraction: AutocompleteInteraction) {
    const focused = acInteraction.options.getFocused().toLowerCase();
    try {
        var games = await client.gamesList!.getGames();
        if (focused !== '') games = games.filter(g => (g.name.toLowerCase().startsWith(focused) || g.domain_name.includes(focused)));
        await acInteraction.respond(
            games.map(g => ({ name: g.name, value: g.domain_name })).slice(0, 25)
        );
    }
    catch(err) {
        logMessage('Error autocompleting games', {err}, true);
        throw err;
    }
}

export const unexpectedErrorEmbed = (err: any, context: any): EmbedBuilder => {
    return new EmbedBuilder()
    .setTitle('Unexpected error')
    .setColor('DarkRed')
    .setDescription('The bot encountered an unexpected error with this command. You may be able to retry after a few minutes. If this issue persists, please report it including the information below.')
    .addFields([
        { 
            name: 'Error Details', value: `\`\`\`${err.message || err}\`\`\``.substring(0,1010)
        },
        {
            name: 'Error Context', value: `\`\`\`json\n${JSON.stringify(context, null, 2).substring(0,1010)}\n\`\`\``
        },
        {
            name: 'Reporting the error', value: 'Please report this on [GitHub](https://github.com/Nexus-Mods/discord-bot/issues/) or the [Nexus Mods server](https://discord.gg/nexusmods).'
        }
    ])
}

export const discontinuedEmbed = (newCommand: string): EmbedBuilder => {
    return new EmbedBuilder()
    .setTitle('Command discontinued')
    .setColor('Grey')
    .setDescription(`This command has been retired, please use the slash command **${newCommand}** instead. [Help](https://discord.gg/nexusmods)`)
}

export const nexusModsTrackingUrl = (url: string, tag?: string): string => {
    const campaign = 'DiscordBot';
    const params = new URLSearchParams();
    params.append('mtm_campaign', campaign);
    if (tag) params.append('mtm_kwd', tag);
    
    return new URL(`${url}?${params.toString()}`).toString();
}