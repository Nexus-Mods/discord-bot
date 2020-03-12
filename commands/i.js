const Discord = require('discord.js');

let cachedInfo;

module.exports.help = {
    name: "i",
    description: "Quick command for displaying an info topic.",
    usage: "[query]",
    moderatorOnly: false,
    adminOnly: false,
    officialOnly: false 
}

exports.run = async (client, message, args, serverData) => {

    cachedInfo = {};
    cachedInfo.data = [
        {
            name: "Vortex",
            embed_title: "Vortex",
            embed_description: "The open source mod manager from Nexus Mods.",
            embed_url: 'https://nexusmods.com/site/mods/1',
            embed_thumb: 'https://staticdelivery.nexusmods.com/mods/2295/images/thumbnails/1/1-1572340547-421046445.png'
        },
        {
            name: "xse",
            embed_title: "Script Extenders",
            embed_description: "Ensure you have the latest version of the script extender.",
            embed_url: 'https://www.nexusmods.com/skyrimspecialedition/mods/30379',
            embed_thumb: 'https://staticdelivery.nexusmods.com/mods/1704/images/thumbnails/30457/30457-1574161389-1639080579.jpeg'
        },
        {
            name: 'smapi',
            embed_title: "Stardew Modding API (SMAPI)",
            embed_description: "SMAPI is required for Stardew Valley modding. Get the latest version [here](https://www.nexusmods.com/stardewvalley/mods/2400).",
            embed_url: 'https://www.nexusmods.com/stardewvalley/mods/2400',
            embed_thumb: 'https://staticdelivery.nexusmods.com/mods/1303/images/thumbnails/2400/2400-1529134549-2089785102.png'
        }
    ];
    // if (!cachedInfo) {
    //     const data = await getAllInfos();
    //     const lastUpdate = new Date();
    //     cachedInfo = { data, lastUpdate };
    // }

    // No arguements specified.
    if (!args || !args.length) {
        const embed = new Discord.RichEmbed()
        .setTitle('Info Command Help')
        .setDescription('This command will return an embed or message based on a preset help topic.\nUse `!nm i {topic}` to invoke this command.')
        .addField('Available Topics (case insensitive)', cachedInfo.data.map(i => i.name).join(", ").substr(0, 1024));

        return message.reply(embed);
    }

    const query = args[0].toLowerCase();
    const result = cachedInfo.data.find(i => i.name.toLowerCase() === query);
    if (!result) return message.channel.send(`Not found: ${query}`);

    const embed = new Discord.RichEmbed()
    if (result.embed_title) embed.setTitle(result.embed_title);
    if (result.embed_description) embed.setDescription(result.embed_description);
    if (result.embed_url) embed.setURL(result.embed_url);
    if (result.embed_thumb) embed.setThumbnail(result.embed_thumb);
    return message.channel.send(embed);
}