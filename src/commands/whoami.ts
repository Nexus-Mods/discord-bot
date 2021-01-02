import { Client, Message, GuildChannel, DMChannel, TextChannel, MessageEmbed } from "discord.js";
import { BotServer } from "../types/servers";
import { getUserByDiscordId, userEmbed } from "../api/users";
import { NexusUser } from "../types/users";

const help = {
    name: "whoami",
    description: "Show your own profile card.",
    usage: "",
    moderatorOnly: false,
    adminOnly: false  
}
async function run(client: Client, message: Message, args: string[], serverData: BotServer) {
    const replyChannel: (GuildChannel | DMChannel | undefined | null) = serverData && serverData.channel_bot ? message.guild?.channels.resolve(serverData.channel_bot) : message.channel;
    const discordId: string = message.author.id;
    try {
        const userData: NexusUser = await getUserByDiscordId(discordId);
        if (!userData) return (replyChannel as TextChannel).send('You have\'t linked your account yet. See `!nm link` for more information.').catch(() => undefined);
        const card: MessageEmbed = await userEmbed(userData, message, client);
        return (replyChannel as TextChannel).send(replyChannel !== message.channel ? message.author : '', card)
            .catch((err) => (replyChannel as TextChannel).send(`Error: ${err.message}`));
    }
    catch(err) {
        if (err.code === 'ETIMEOUT') return (replyChannel as TextChannel).send('I\'m afraid I can\'t connect to my database right now. Please try again later.').catch(() => undefined);
        return (replyChannel as TextChannel).send(`An Error occured with your request: \`\`\`${JSON.stringify(err)}\`\`\``).catch(() => undefined);
    }

}


export { run, help };