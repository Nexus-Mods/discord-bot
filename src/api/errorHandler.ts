import { MessageEmbed } from 'discord.js';

function errorReply(e: Error): MessageEmbed {
    const errEmbed = new MessageEmbed()
    .setAuthor('Error', )
    .setColor('#ff0000')
    .setThumbnail('https://i.imgur.com/GkXTERx.png')
    .setDescription(getText(e))
    .setTimestamp(new Date())
    .setFooter('');

    return errEmbed;
}

function getText(err: any): string {
    switch (err.code) {
        case 'ETIMEDOUT' : return 'Connection timed out. Please try again later.';
        default: return `While trying to complete your request the following error occurred:\n ${err.message}`;
    }
}

export default errorReply;