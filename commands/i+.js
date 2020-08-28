const Discord = require('discord.js');
const { getAllInfos, createInfo, deleteInfo, displayInfo } = require('../api/bot-db.js');


exports.run = async (client, message, args, serverData) => {
    // message.reply(`Info added ${args.join(' ')}`)

    if (!args || !args.length) return message.channel.send(noArgsEmbed(client, message));

    const data = await getAllInfos();
    const newName = args.join(' ');

    const existing = data.find(i => i.name === newName);
    if (existing) {
        message.channel.send(`The following message already exists for "${newName}"`);
        return displayInfo(client, message, existing);
    }
    
    let newInfo = { name: newName }; //Start building out data.

    const embedMessage = await message.channel.send(`Your embed preview will appear here.`);

    // For ease, we'll just do JSON initially.

    await message.channel.send(`Please send you embed in the following JSON format.\n\`\`\`json\n${JSON.stringify(sampleJSON, null, 2)}\`\`\``);

    const textMessageFilter = m => m.author === message.author;
    const textCollector = message.channel.createMessageCollector(textMessageFilter, { time: 40000, max: 3 });
    textCollector.on('collect', m => {
        let content = m.cleanContent;
        content = content.replace('```json', '').replace(/(`+)/g, '');
        try {
            const infoData = JSON.parse(content);
            infoData.approved = true;
            infoData.author = message.author.username;
            const embedToSend = displayInfo(client, message, infoData, false);
            embedMessage.edit(infoData.message || '', embedToSend);
            m.delete();
            textCollector.stop();
        }
        catch (err) {
            console.log(err);
        }

        
    });
    
    textCollector.on('end', collected => {
        
    });

    return;
    /* NOT IN USE YET */

    // Step 1 - Title
    const getTitle = await textResponseEmbed(client, undefined, message, 
        'Enter info title (1/7)', 'Reply with the title you wish to use. React with ➡️ to skip.' );
    newInfo.title = getTitle.value;
    embedMessage.edit('', { embed: displayInfo(client, message, newInfo, false) });


    // Step 2 - Description
    // Step 3 - URL
    // Step 4 - Thumbnail
    // Step 5 - Image
    // Step 6 - Fields
    // Step 7 - Review + Save



}

async function textResponseEmbed(client, lastMessage, userMessage, title, description) {
    const embed = new Discord.RichEmbed()
    .setColor(0xda8e35)
    .setTitle(title)
    .setDescription(description)
    .setFooter(`Nexus Mods API link - ${userMessage.author.tag}: ${userMessage.cleanContent}`,client.user.avatarURL);

    const textInputMessage = lastMessage ? await lastMessage.edit('', {embed}) : message.channel.send(embed);

    // Setup skip reaction.

    const textMessageFilter = m => m.author === userMessage.author;
    const textCollector = textInputMessage.channel.createMessageCollector(textMessageFilter, { time: 30000, max: 1 });
    textCollector.on('end', collected => {
        return {
            message: textInputMessage,
            value: collected.first().content
        }
    });

}

const noArgsEmbed = (client, message) => new Discord.RichEmbed()
.setColor(0xda8e35)
.setTitle('Add a new info prompt')
.setDescription('This command will walk you through the process of creating a new info message with the Nexus Mods bot. All messages have to be approved before they are publicly available, please keep the relevant to modding or Nexus Mods.')
.addField('JSON Example', `\`\`\`${JSON.stringify(sampleJSON, null, 2)}\`\`\``)
.addField('Support', `For further help with this feature, please visit the [Nexus Mods Discord server](https://discord.gg/nexusmods)`)
.setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL);

const sampleJSON = {
    message: "Text message to send.", //Message to respond with
    title: "Embed Title", //title of the embed and/or summary of the topic
    description: "Description field in the embed. Markdown is supported.", //embed description
    url: "https://nexusmods.com", //embed url
    thumbnail: "https://forums.nexusmods.com/uploads/profile/photo-thumb-31179975.png?r_=1557319981", //thumbnail for embed
    image: "https://forums.nexusmods.com/uploads/profile/photo-thumb-31179975.png?r_=1557319981", //image for embed
    fields: [
        {
            name: "Title of inline field (Max 20 fields)",
            value: "Text under the heading. Markdown is supported. Use inline to display on the same line as previous contnet.",
            inline: false
        },
        {
            name: "Another field",
            value: "[Links can be added](https://nexusmods.com) using `Markdown`."
        }
    ], //array of embed fields
}