import { MessageEmbed } from 'discord.js';

function errorReply(e: Error): MessageEmbed {
    const errEmbed = new MessageEmbed()
    .setTitle('Error')
    .setColor('#ff0000')
    .setThumbnail('https://discord.com/assets/289673858e06dfa2e0e3a7ee610c3a30.svg')
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