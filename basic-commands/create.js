const { createUser } = require('../api/bot-db.js');

exports.run = async (client, message) => {
    const user = {
        d_id: message.author.id,
        id: 31179975,
        name: "Pickysaurus",
        avatar_url: "https://forums.nexusmods.com/uploads/profile/photo-thumb-31179975.png?r_=1557319981",
        apikey: "UStyYllZRUxkb2ZTVE0zQkd4MTA1cG44K0ZXM0N6MldadU5WYnVHaUNZMzZ0OTFoNWNxV2xPNytnTG0yd2svTC0tMGxPdjhBaTBGNDl0K2xPUzZGdkpOQT09--dcb9a10a63c320ffd48c64b3f624694b62fec2db",
        supporter: true,
        premium: true,
        servers: [message.guild.id]
    };
    try {
        const newUser = await createUser(user);
        if (newUser === true) message.channel.send("Success!");
        else message.channel.send("Failed :("); 
    }
    catch(err) {
        message.channel.send(err)
        console.log(err);
    }
}