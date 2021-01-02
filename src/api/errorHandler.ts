import { Message, MessageEmbed } from 'discord.js';

function errorReply(e: Error, message: Message): MessageEmbed {
    const errEmbed = new MessageEmbed()
    .setAuthor('Error', 'https://i.imgur.com/GkXTERx.png')
    .setColor('#ff0000')
    .setDescription(getText(e))
    .setTimestamp(new Date())
    .setFooter(`${message.author.tag}: ${message.cleanContent}`);

    return errEmbed;
}

function getText(err: any): string {
    switch (err.code) {
        case 'ETIMEDOUT' : return 'Connection timed out. Please try again later.';
        default: return `While trying to complete your request the following error occurred:\n ${err.code || err.message}`;
    }
}

export default errorReply;