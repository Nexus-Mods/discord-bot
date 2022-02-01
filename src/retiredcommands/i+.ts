import { Client, Message } from "discord.js";
import { CommandHelp } from "../types/util";

const help: CommandHelp = {
    name: "i+",
    description: "Add a new displayable info topic.",
    usage: "[query]",
    moderatorOnly: false,
    adminOnly: true,
    officialOnly: false 
}

async function run(client: Client, message: Message, args: string[]) {
    if (!process.env.ownerID?.includes(message.author.id)) return message.reply('You do not have permission to use this command').catch(() => undefined);
    
}

export { run, help };


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