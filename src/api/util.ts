import { EmbedBuilder } from "discord.js";

export const logMessage  = (msg: string, obj?: any, error?: boolean) => {
    const message = `${new Date().toLocaleString()} - ${msg}`;
    error === true ? console.error(message, obj || '') : console.log(message, obj || '');
};

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

export const upgradeWarning = (): EmbedBuilder => {
    return new EmbedBuilder()
    .setTitle('Notice')
    .setColor('LightGrey')
    .setDescription('Due to on-going upgrade work, this bot command may not work as expected. Thank you for being patient.')
}