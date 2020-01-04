const { updateUser } = require('../api/bot-db.js');

exports.run = async (client, message) => {
    const user = {
        servers: [message.guild.id, "215154001799413770", "1111", "11123242", "112312423", "76576575", "09098"],
        mods: [
            {
                name: "Mod 1",
                downloads: 5555,
                gameTitle: "Skyrim",
                domain: "skyrim",
                modId: 1,
                url: "https://nexusmods.com/skyrim/mods/1"
            },
            {
                name: "Mod 2",
                downloads: 5555,
                gameTitle: "Skyrim",
                domain: "skyrim",
                modId: 2,
                url: "https://nexusmods.com/skyrim/mods/2"
            }
        ],
        modauthor: true,
        moddownloads: 5555 * 2
    };
    try {
        const newUser = await updateUser(message.author.id, user);
        if (newUser === true) message.channel.send("Success!");
        else message.channel.send("Failed :("); 
    }
    catch(err) {
        message.channel.send(err)
        console.log(err);
    }
}