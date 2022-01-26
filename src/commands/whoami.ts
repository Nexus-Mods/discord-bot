import { Client, Message, GuildChannel, PartialDMChannel, DMChannel, TextChannel, MessageEmbed, ThreadChannel } from "discord.js";
import { BotServer } from "../types/servers";
import { getUserByDiscordId, userEmbed } from "../api/users";
import { NexusUser } from "../types/users";
import errorReply from "../api/errorHandler";

const redundantMessage: string = 'This command is being retired. Please use the `/profile` slash command in future.';

const help = {
    name: "whoami",
    description: "Show your own profile card.",
    usage: "",
    moderatorOnly: false,
    adminOnly: false  
}
async function run(client: Client, message: Message, args: string[], serverData: BotServer) {
    const replyChannel: (GuildChannel| PartialDMChannel | DMChannel | ThreadChannel | undefined | null) = serverData && serverData.channel_bot ? message.guild?.channels.resolve(serverData.channel_bot) : message.channel;
    const discordId: string = message.author.id;

    try {
        const userData: NexusUser = await getUserByDiscordId(discordId);
        if (!userData) return (replyChannel as TextChannel).send('You have\'t linked your account yet. See `!nm link` for more information.').catch(() => undefined);
        const card: MessageEmbed = await userEmbed(userData, message, client);
        return (replyChannel as TextChannel).send({ content: replyChannel !== message.channel ? message.author.toString() + redundantMessage : redundantMessage, embeds: [card] })
            .catch((err) => (replyChannel as TextChannel).send(`Error: ${err.message}`));
    }
    catch(err: any) {
        return (replyChannel as TextChannel).send({ embeds: [errorReply(err, message)] }).catch(() => undefined);
    }

}


export { run, help };