const { deleteUser } = require('../api/bot-db.js');

exports.run = async (client, message) => {
    try {
        const deleteConfirm = await deleteUser(message.author.id);
        if (deleteConfirm === true) message.channel.send("Success!");
        else message.channel.send("Failed :("); 
    }
    catch(err) {
        console.log(err);
    }
}