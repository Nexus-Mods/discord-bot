import { Client, Message, MessageEmbed, GuildMember, MessageReaction, User, TextChannel, Webhook, Collection, ReactionCollector, MessageCollector } from "discord.js";
import { BotServer } from "../types/servers";
import { CommandHelp } from "../types/util";
import { getGameFeedsForServer, getGameFeed, deleteGameFeed, updateGameFeed, getUserByDiscordId, createGameFeed } from "../api/bot-db";
import { GameFeed } from "../types/feeds";
import { games } from "../api/nexus-discord";
import { NexusUser } from "../types/users";
import { IGameInfo } from "@nexusmods/nexus-api";
import { logMessage } from '../api/util';

const toggles = ["✅", "❌", "🆕", "⏫", "🔞", "🕹","📬","📭", "↕️"];

const help: CommandHelp = {
    name: "gamefeed",
    description: "Creates a game feed in this channel, publishing new or updated mods every 10 minutes.",
    usage: "<game> | edit #<id>",
    moderatorOnly: true,
    adminOnly: false 
}

async function run(client: Client, message: Message, args: string[], server: BotServer) {
    // Block usage in DMs.
    if (!message.guild) message.reply('This feature is not available in DMs.').catch(() => undefined);

    // Tutorial of no args have been sent. 
    if (!args.length) return message.reply({embeds: [await tutorialEmbed(client, message)]}).catch(() => undefined);

    // Catch command to edit the existing feed.
    if (args[0].toLowerCase() === 'edit' && args[1].startsWith('#')) {
        const feedId: number = parseInt(args[1].substr(1));
        // If the feed id isn't a number.
        if (feedId === NaN) return message.reply(`Invalid feed ID: ${args[1]}`).catch(() => undefined);
        const feed: GameFeed|undefined = await getGameFeed(feedId).catch(() => undefined);
        if (!feed) return message.reply(`Could not find a feed with ID: ${feedId}`).catch(() => undefined);
        const owner: GuildMember | undefined = message.guild?.members.resolve(feed.owner) || undefined;
        if (message.member !== owner && !message.member?.permissions.has('MANAGE_CHANNELS')) return message.reply("You do not have permission to edit this feed.").catch(() => undefined); 
        if (feed.guild !== message.guild?.id) return message.reply(`Feed #${feedId} can only be managed from the server it was created in.`).catch(() => undefined);
        return manageFeed(client, message, feed).catch((err) => message.reply(`Something went wrong managing your feed: ${err.message}`).catch(() => undefined));
    }

    // Prevent non-moderators from setting up the feed.
    if (!message.member?.permissions.has('MANAGE_CHANNELS')) return message.reply('Gamefeeds can only be created or managed by server moderators with the "Manage Channels" permission.').catch(() => undefined);

    // Get user data
    const userData: NexusUser|undefined = await getUserByDiscordId(message.author.id).catch(() => undefined);
    if (!userData) return message.reply("Please link your Nexus Mods account to your Discord account before using this feature. See `!nexus link` help on linking your account.").catch(() => undefined);

    // Start setting up a new game feed.
    const newFeedMsg: Message|undefined = await message.reply('Checking for matching games...').catch(() => undefined);
    const nsfw = (message.channel as TextChannel).nsfw;
    const query = args.join('').toLowerCase();
    let gameForFeed: IGameInfo|undefined;
    try {
        const allGames: IGameInfo[] = await games(userData);
        gameForFeed = allGames.find(g => g.name.toLowerCase() === query || g.domain_name.toLowerCase() === query );
        if (!gameForFeed) throw new Error(`No matching game for ${query}`);
    }
    catch(err) {
        return newFeedMsg?.edit(`Error in game lookup: ${err.message || err}`).catch(() => undefined);
    }

    logMessage('Creating new game feed', { author: message.author, guild: message.guild?.name, game: gameForFeed.name });

    const confirm = confirmEmbed(client, message, gameForFeed, userData, nsfw);
    newFeedMsg?.edit({ content: null, embeds: [confirm] }).catch(() => undefined);
    const filter = (reaction: MessageReaction, user: User) => (!!reaction.emoji.name && ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id);
    const collector: ReactionCollector | undefined = newFeedMsg?.createReactionCollector({ filter, max: 1, time: 15000 });
    newFeedMsg?.react('✅');
    newFeedMsg?.react('❌');

    collector?.on('collect', async r => {
        // Cancel
        if (r.emoji.name === '❌') return newFeedMsg?.edit({ content: 'Game feed setup cancelled.', embeds: [] }).catch(() => undefined);
        // Create
        let gameHook: Webhook|undefined;
        const webHooks: Collection<string, Webhook>|undefined = await message.guild?.fetchWebhooks().catch(() => undefined);
        const existing: Webhook|undefined = webHooks?.find(wh => wh.channelId === message.channel.id && wh.name === 'Nexus Mods Game Feed');
        if (!existing) gameHook = await (message.channel as TextChannel).createWebhook('Nexus Mods Game Feed', { avatar: client.user?.avatarURL() || '', reason: 'Game feed'} ).catch(() => undefined);
        else gameHook = existing;

        const newFeed: any = {
            channel: message.channel.id,
            guild: message.guild?.id || '',
            owner: message.author.id,
            domain: gameForFeed?.domain_name || '',
            title: gameForFeed?.name || '',
            nsfw,
            sfw: true,
            show_new: true,
            show_updates: true,
            webhook_id: gameHook?.id,
            webhook_token: gameHook?.token || undefined
        }

        try {
            const id = await createGameFeed(newFeed);
            console.log(new Date().toLocaleString() + ` - Game feed created for ${gameForFeed?.name} in ${(message.channel as TextChannel).name} at ${message.guild?.name} by ${message.author.tag} successfully. Reference #${id}`);
            await newFeedMsg?.edit({ content: null, embeds: [successEmbed(message, newFeed, gameForFeed, id)] }).catch(() => undefined);
            return newFeedMsg?.pin().catch(undefined);
        }
        catch(err: any) {
            console.log(err);
            return newFeedMsg?.edit({ content: `Error creating gamefeed: ${err.message || err}`, embeds: [] }).catch(() => undefined);
        }

    });

    collector?.on('end', rc => {
        newFeedMsg?.reactions.removeAll().catch(() => undefined);
        if (!rc.size) newFeedMsg?.edit({ content: 'Game feed setup cancelled.', embeds: null }).catch(() => undefined);
    });

}

const successEmbed = (message: Message, feed: GameFeed, game: IGameInfo|undefined, id: number): MessageEmbed => {
    return new MessageEmbed()
    .setTitle(`Mods for ${feed.title} will be posted in this channel`)
    .setColor(0xda8e35)
    .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${game?.id}.jpg`)
    .setFooter({text: `Feed ID: #${id} - Created by: ${message.author.tag}` })
    .setTimestamp(new Date());
}

const confirmEmbed = (client: Client, message: Message, game: IGameInfo, user: NexusUser, nsfw: boolean): MessageEmbed => {
    return new MessageEmbed()
    .setAuthor({ name: message.author.tag, iconURL: message.author.avatarURL() || '' })
    .setColor(0xda8e35)
    .setTitle(`Create game feed in ${(message.channel as TextChannel).name}?`)
    .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${game.id}.jpg`)
    .setDescription(
        `New and updated mods for ${game.name} will be posted in ${message.channel.toString()} periodically.\n`+
        `Adult content ${nsfw ? "will" : "will not"} be included.\n`+
        `The API key for ${user.name} will be used.`
    )
    .addField('Options', 'React with ✅ to confirm or ❌ to cancel.')
    .setFooter({ text: `Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`, iconURL: client.user?.avatarURL() || '' })
}

const tutorialEmbed = async (client: Client, message: Message): Promise<MessageEmbed> => {
    const feeds: GameFeed[] = message.guild ? await getGameFeedsForServer(message.guild.id).catch(() => []) : [];
    const feedFields: string[] = feeds.map(feed => `**${feed._id}** - ${feed.title} created by ${message.guild?.members.resolve(feed.owner)?.toString() || '*Unknown*'} in <#${feed.channel}>.\n`
        + `🆕: ${feed.show_new} | ⏫: ${feed.show_updates} | 🔞: ${feed.nsfw} | 🕹: ${feed.sfw}`);
    
    return new MessageEmbed()
    .setTitle('Game Feeds')
    .setDescription("Using this feature you can create a feed in this channel which will periodically report new and updated mods posted for a specfied game."+
    "\n\nTo set up the feed add the name or domain of the game to the end of the command e.g. \"Stardew Valley\" or \"stardewvalley\"."+
    "\n\nBy default adult content will only be included if the channel is marked NSFW in Discord."+
    "\n\n*The feed will use the API key linked to your account and can consume approximately 144 - 1500 requests per day depending on your settings and the number of mods posted.*")
    .addField('Editing or cancelling feeds', 'To edit an existing feed, added edit followed by a hash and the number reference of your feed e.g. !nexus gamefeed edit #1.')
    .addField(`Feeds in ${message.guild?.name || 'this server'}`, feedFields.length ? feedFields.join('\n'): '*none*')
    .setColor(0xda8e35)
    .setFooter({ text: `Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`, iconURL: client.user?.avatarURL() || '' })

}

async function manageFeed(client: Client, message: Message, feed: GameFeed): Promise<void> {
    const embed = new MessageEmbed()
    .setTitle(`Editing GameFeed #${feed._id}`)
    .setColor(0xd8e35)
    .setFooter({ text: `Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`, iconURL: client.user?.avatarURL() || '' })
    .setTimestamp(feed.created)
    .setDescription(
        `Game: ${feed.title}\n`+
        `Channel: ${message.guild?.channels.resolve(feed.channel) || '*Unknown*'}\n`+
        `Created by: ${message.guild?.members.resolve(feed.owner)?.toString() || '*???*'}\n`+
        `Message: ${feed.message ? `"${feed.message}"` : '*Not set*'} - Update: 📬 | Remove: 📭.\n\n`+
        `To change the feed settings, use the reaction with the matching icon. ✅ confirms the changes, ❌ cancels the feed.`
    )
    .addField('Settings', 
        `🆕 Show new: ${feed.show_new} | ⏫ Show updates: ${feed.show_updates} | ↕ Compact Mode: ${feed.compact}\n`+
        `🔞 Adult Content: ${feed.nsfw} | 🕹 Safe Content: ${feed.sfw}`
    );

    // Send the embed
    const editMsg = await message.reply({embeds: [embed]}).catch((e) => Promise.reject(e));
    const filter = (reaction: MessageReaction, user: User) => user.id === message.author.id && !!reaction.emoji.name && toggles.includes(reaction.emoji.name);
    const collector: ReactionCollector = editMsg.createReactionCollector({ filter, time: 30000, max: 15});
    toggles.forEach(emoji => editMsg.react(emoji));

    let newData: any = {};

    collector.on('collect', async r => {
        switch (r.emoji.name) {
            case('✅'): {
                collector.stop('Stopped by user');
                await editMsg.reactions.removeAll().catch(() => undefined);
            }
            break;

            case('🆕'): {
                newData.show_new = !feed.show_new;
                message.reply(`New mod uploads ${newData.show_new ? 'included' : 'hidden'}.`).catch(() => undefined);
            }
            break;

            case('⏫'): {
                newData.show_updates = !feed.show_updates;
                message.reply(`Updated mods ${newData.show_updates ? 'included' : 'hidden'}.`).catch(() => undefined);
            }
            break;

            case('🔞'): {
                newData.nsfw = !feed.nsfw;
                message.reply(`Adult only mods ${newData.nsfw ? 'included' : 'hidden'}.`).catch(() => undefined);
            }
            break;

            case('🕹'): {
                newData.sfw = !feed.sfw;
                message.reply(`Safe for work mods ${newData.sfw ? 'included' : 'hidden'}.`).catch(() => undefined);
            }
            break;

            case('📬'): {
                const msg = await message.reply('Type a message you would like to send when new mods are available.');
                const msgCollect: MessageCollector = message.channel.createMessageCollector({ filter: m => m.author === message.author, max: 1, time: 15000});
                msgCollect.on('collect', m => {
                    newData.message = m.content;
                    msg.edit(`Before each feed update the following message will be sent: "${m.content}"`).catch(err => undefined);
                })
                
                msgCollect.on('end', mc => {
                    if (!mc.size) msg.edit('No message was set.').catch(() => undefined);
                })
            }
            break;

            case('📭'): {
                newData.message = null;
                message.reply(`Update message removed.`).catch(() => undefined);
            }
            break;

            case('↕️'): {
                newData.compact = !feed.compact;
                message.reply(`Post size set to ${newData.compact ? 'compact' : 'default'}.`).catch(() => undefined);
            }
            break;

            case('❌'): collector.stop('Game feed deleted');
            break;
        }
    });

    collector.on('end', async rc => {
        editMsg.reactions.removeAll().catch(() => undefined);
        if (rc.find(r => r.emoji.name === '❌')) {
            // Delete feed
            try {
                await deleteGameFeed(feed._id);
                console.log(`${new Date().toLocaleString()} - Game feed #${feed._id} for ${feed.title} in ${(message.channel as TextChannel).name} at ${message.guild?.name} deleted by ${rc.first()?.users.cache.first()?.tag}`);
                return editMsg.edit({ content: 'The GameFeed has been deleted.', embeds: null }).catch(() => undefined);
            }
            catch(err: any) {
                return editMsg.edit({ content: `There was a problem deleting your feed: ${err.message || err}`, embeds: null }).catch(() => undefined);
            }
        }
        else {
            // Update feed
            try {
                if (Object.keys(newData).length) await updateGameFeed(feed._id, newData);
                console.log(`${new Date().toLocaleString()} - Game feed #${feed._id} for ${feed.title} in ${(message.channel as TextChannel).name} at ${message.guild?.name} edited by ${rc.first()?.users.cache.last()?.tag}`);
                return editMsg.edit({ content: 'Game feed saved successfully.', embeds: null }).catch(() => undefined);
            }
            catch (err: any) {
                return editMsg.edit(`There was a problem updating your feed: ${err.message || err}`).catch(() => undefined);
            }

        }
    })

}

export { run, help }