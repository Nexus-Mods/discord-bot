import { MessageEmbed } from "discord.js";

export const logMessage  = (msg: string, obj?: object, error?: boolean) => {
    const message = `${new Date().toLocaleString()} - ${msg}`;
    error === true ? console.error(message, obj || '') : console.log(message, obj || '');
};

export const unexpectedErrorEmbed = (err: any, context: any): MessageEmbed => {
    return new MessageEmbed()
    .setTitle('Unexpected error')
    .setColor('DARK_RED')
    .setDescription('The bot encountered an unexpected error with this command. You may be able to retry after a few minutes. If this issue persists, please report it including the information below.')
    .addField('Error Details', `\'\'\'${err}\'\'\'`.substring(0,1010))
    .addField('Error Context', `\'\'\'${JSON.stringify(context, null, 2)}\'\'\'`.substring(0,1010))
    .addField('Reporting the error', 'Please report this on [GitHub](https://github.com/Nexus-Mods/discord-bot/issues/) or the [Nexus Mods server](https://discord.gg/nexusmods).')
}

export const discontinuedEmbed = (newCommand: string): MessageEmbed => {
    return new MessageEmbed()
    .setTitle('Command discontinued')
    .setColor('GREY')
    .setDescription(`This command has been retired, please use the slash command **${newCommand}** instead. [Help](https://discord.gg/nexusmods)`)
}