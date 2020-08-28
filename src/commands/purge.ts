import { Client, Message, TextChannel } from "discord.js";

const help = {
    name: "purge",
    description: "Removes the specified ammount of messages from the current channel. Note: Messages over 14 days cannot be deleted. **Admin only**",
    usage: "[#number(0-100)]",
    moderatorOnly: true,
    adminOnly: false  
}

async function run(client: Client, message: Message, args: string[]) {
    if (!message.guild) return;
    if (!message.member?.hasPermission('BAN_MEMBERS')) return;
    if (!args.length) return message.channel.send('Please specify how many messages to delete (Max: 100).').catch(() => undefined);
    let count: number = parseInt(args[0]);
    if (count === NaN) return;
    if (count < 0) return;
    if (count > 100) count = 100;
    try {
        await (message.channel as TextChannel).bulkDelete(count);
        message.channel.send(`Deleted ${count} messages`).catch(() => undefined);
    }
    catch(err) {
        return message.channel.send(`Error deleting messages: ${err.message}`).catch(() => undefined);
    }
}


export { run, help };