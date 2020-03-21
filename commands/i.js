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

const genericEmbed = new Discord.RichEmbed()
.setColor(0xda8e35);

exports.run = async (client, message, args, serverData) => {
    const replyChannel = serverData && serverData.channel_bot ? message.guild.channels.find(c => c.id === serverData.channel_bot) : message.channel;

    cachedInfo = {};
    cachedInfo.data = [
        {
            name: "vortex",
            embed_title: "Vortex",
            embed_description: "The open source mod manager from Nexus Mods.",
            embed_url: 'https://nexusmods.com/site/mods/1',
            embed_thumb: 'https://staticdelivery.nexusmods.com/mods/2295/images/thumbnails/1/1-1572340547-421046445.png',
            last_edit: 'Thu Jan 01 1970 01:00:00 GMT+0100 (Greenwich Mean Time)',
            created_by: "Pickysaurus"
        },
        {
            name: "xse",
            embed_title: "Script Extenders",
            embed_description: "Ensure you have the latest version of the script extender.",
            // embed_url: 'https://www.nexusmods.com/skyrimspecialedition/mods/30379',
            embed_thumb: 'https://staticdelivery.nexusmods.com/mods/1704/images/thumbnails/30457/30457-1574161389-1639080579.jpeg',
            embed_fields: [
                {
                    name: "Skyrim",
                    value: "[SKSE 1.1.16](https://skse.silverlock.org/)",
                    inline: true
                },
                {
                    name: "Skyrim Special Edition",
                    value: "[SKSE64 2.0.32](https://skse.silverlock.org/)",
                    inline: true
                },
                {
                    name: "Skyrim VR",
                    value: "[SKSEVR 2.0.64](https://skse.silverlock.org/)",
                    inline: true
                },
                {
                    name: "Fallout 4",
                    value: "[F4SE 0.0.15](https://f4se.silverlock.org/)",
                    inline: true
                },
                {
                    name: "Fallout 3",
                    value: "[F4SE 0.0.15](https://f4se.silverlock.org/)",
                    inline: true
                },
                {
                    name: "Fallout 4 VR",
                    value: "[F4SE 0.0.15](https://f4se.silverlock.org/)",
                    inline: true
                },
                {
                    name: "Fallout New Vegas",
                    value: "[F4SE 0.0.15](https://f4se.silverlock.org/)",
                    inline: true
                },
                {
                    name: "Oblivion",
                    value: "[F4SE 0.0.15](https://f4se.silverlock.org/)",
                    inline: true
                },
                {
                    name: "Morrowind",
                    value: "[F4SE 0.0.15](https://f4se.silverlock.org/)",
                    inline: true
                }
            ],
            last_edit: 'Thu Jan 01 1970 01:00:00 GMT+0100 (Greenwich Mean Time)',
            created_by: "Pickysaurus"
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
        .setColor(0xda8e35)
        .setTitle('Info Command Help')
        .setDescription('This command will return an embed or message based on a preset help topic.\nUse `!nm i {topic}` to invoke this command.')
        .addField('Available Topics (case insensitive)', cachedInfo.data.map(i => `${i.embed_title} [${i.name}]`).join("\n").substr(0, 1024))
        .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL);

        return replyChannel.send(replyChannel !== message.channel ? message.author : '', embed);
    }

    const query = args[0].toLowerCase();
    const result = cachedInfo.data.find(i => i.name.toLowerCase() === query);
    if (!result) return replyChannel.send(`${replyChannel !== message.channel ? `${message.author}, ` : ''}No matching info documents found for "${query}".`);

    const embed = new Discord.RichEmbed()
    .setFooter(`Added by ${result.created_by || '???'} - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL)
    .setTimestamp(result.last_edit || new Date())
    .setColor(0xda8e35);
    if (result.embed_title) embed.setTitle(result.embed_title);
    if (result.embed_description) embed.setDescription(result.embed_description);
    if (result.embed_url) embed.setURL(result.embed_url);
    if (result.embed_thumb) embed.setThumbnail(result.embed_thumb);
    if (result.embed_fields) result.embed_fields.map(field => embed.addField(field.name, field.value, field.inline));
    return message.channel.send(embed);
}