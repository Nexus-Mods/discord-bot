import { EmbedBuilder, type Guild, type GuildMember } from 'discord.js';
import { NEXUS_ORANGE } from '../lib/embeds.js';
import { assertPresent } from '../lib/assert.js';
import { gameArt, nexusModsTrackingUrl } from '../api/util.js';
import type { Logger } from "@nexusmods/core/logger.js";
import { getUserByNexusModsId } from '../api/users.js';
import { customEmojis } from '../types/util.js';
import type { CollectionStatus, ICollection, ICollectionRevision, IMod, IModFile } from '../api/queries/v2.js';
import type { IUser } from '../api/queries/v2-finduser.js';
import type { ModStatus } from '../types/GQLTypes.js';
import {
    type EntityType,
    type IModWithFiles,
    type IPostableSubscriptionUpdate,
    type SubscribedItem,
    SubscribedItemType,
} from '../types/subscriptions.js';

/**
 * Rendering for the subscription feeds.
 *
 * This was 380 lines at the bottom of types/subscriptions.ts, which made the
 * subscription model a module that imports EmbedBuilder - so anything reading a
 * subscription pulled Discord presentation in behind it. The auth site did: it reaches
 * subscriptions for the tracking page, and got the embed builders with them. A data
 * layer that renders is also a data layer that cannot be shared with a web app that
 * renders differently.
 *
 * Only SubscriptionManager calls any of this, so it lives with the feeds.
 */

type UserEntityType<T extends UserEmbedType | undefined> =
    T extends 'new-mod' | 'updated-mod' ? IUser & { mod: T extends 'new-mod' ? IMod : IModWithFiles } :
    T extends 'new-collection' | 'updated-collection' ? IUser & { collection: ICollection } :
    T extends 'new-image' | 'new-video' ? any : null;

export enum UserEmbedType {
    NewMod = 'new-mod',
    UpdatedMod = 'updated-mod',
    NewCollection = 'new-collection',
    UpdatedCollection = 'updated-collection',
    NewImage = 'new-image',
    NewVideo = 'new-video'
}

export async function subscribedItemEmbed<T extends SubscribedItemType>(logger: Logger, entity: EntityType<T>, sub: SubscribedItem<T>, guild: Guild, updated: boolean = false, userEmbedType: UserEmbedType | null = null): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder();
    const compact: boolean = sub.compact;
    switch (sub.type) {
        case SubscribedItemType.Game: {
            const mod = entity as IModWithFiles;
            const lastestFile = updated ? mod.files?.[0] : undefined;
            const gameThumb: string = gameArt(mod.game.id, '2_3');
            const gameIcon: string = gameArt(mod.game.id, 'icon');
            // Try and find a Discord user for the mod uploader
            const linkedUser = await getUserByNexusModsId(mod.uploader.memberId);
            const guildMember: GuildMember | undefined = linkedUser ? await guild.members.fetch(linkedUser?.DiscordId).catch(() => undefined) : undefined;

            embed.setTitle(mod.name)
            .setURL(nexusModsTrackingUrl(`https://www.nexusmods.com/${mod.game.domainName}/mods/${mod.modId}`, 'subscribedGame'))
            .setDescription(mod.summary.length ? mod.summary : '_No summary_')
            .setImage(compact ? null :  mod.pictureUrl || null)
            .setThumbnail(compact ? mod.pictureUrl : gameThumb)
            // Updated or otherwise
            if (updated) {
                embed.setColor(0x57a5cc)
                .setAuthor({ name: `Mod Updated (${mod.game.name})`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png' })
                .setTimestamp(new Date(lastestFile ? lastestFile.date * 1000 : mod.updatedAt))
                if (lastestFile && lastestFile.changelogText.length) {
                    const changelog = trimModChangelog(lastestFile.changelogText, 1000, logger);
                    if (changelog?.length) embed.addFields({ name: `Changelog (v${lastestFile.version})`, value: trimModChangelog(lastestFile.changelogText, 1000, logger)});
                }
            }
            else {
                embed.setColor(NEXUS_ORANGE)
                .setAuthor({ name: `New Mod Upload (${mod.game.name})`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png' })
                .setTimestamp(new Date(mod.createdAt))
            }
            embed.setFooter({ text: `${mod.game.name}  •  ${mod.modCategory?.name ?? 'Invalid Category'}  • v${mod.version} `, iconURL: gameIcon })
            .addFields(
                {
                    name: 'Author',
                    value: mod.author ?? 'Unknown Author',
                    inline: true
                },
                {
                    name: 'Uploader',
                    value: `[${mod.uploader.name}](${nexusModsTrackingUrl(`https://nexusmods.com/users/${mod.uploader.memberId}`, 'subscribedGame')})`,
                    inline: true
                }
            )
            if (guildMember) embed.addFields({ name: 'Discord', value: guildMember.toString(), inline: true })

        }
        break;
        case SubscribedItemType.Mod: {
            const modWithFiles: IModWithFiles = entity as IModWithFiles;
            const file: IModFile = modWithFiles.files![0];
            const changelog = file.changelogText.length ? trimModChangelog(file.changelogText, compact ? 500: 1000, logger) : undefined;
            embed.setColor('#2dd4bf')
            .setAuthor({ 
                name: modWithFiles.uploader.name, 
                url: nexusModsTrackingUrl(`https://nexusmods.com/users/${modWithFiles.uploader.memberId}`, 'subscribedMod'),
                iconURL: modWithFiles.uploader.avatar
            })
            .setTitle(`${file.name} v${file.version} is now available!`)
            .setDescription(`A new version can be downloaded from [${modWithFiles.name}](${nexusModsTrackingUrl(`https://nexusmods.com/${modWithFiles.game.domainName}/mods/${modWithFiles.modId}`, 'subscribedMod')}) on Nexus Mods.\n${changelog ? `## Changelog\n${changelog}` : ''}`)
            // .setURL(nexusModsTrackingUrl(`https://nexusmods.com/${modWithFiles.game.domainName}/mods/${modWithFiles.modId}`, 'subscribedMod', { 'tab': 'files' }))
            .setThumbnail(modWithFiles.pictureUrl)
            .setTimestamp(new Date(file.date * 1000))
            .setFooter({ text: `${modWithFiles.game.name} •  ${modWithFiles.modCategory?.name ?? 'Invalid Category'} • v${modWithFiles.version}`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png' })
            .addFields(
                file.manager === 0 
                ?   {
                        name: 'Mod Manager',
                        value: `[Download ↗](https://discordbot.nexusmods.com/nxm?type=mod&domain=${modWithFiles.game.domainName}&mod_id=${modWithFiles.modId}&file_id=${file.fileId})\n-# Requires Premium 💎`,
                        inline: true
                    } 
                :   {
                        name: 'Direct Download',
                        value: `[Download ↗](${nexusModsTrackingUrl(`https://www.nexusmods.com/${modWithFiles.game.domainName}/mods/${modWithFiles.modId}`, 'subscribedMod', { 'tab': 'files', 'file_id': file.fileId.toString() })})`,
                        inline: true
                    },
                {
                    name: 'Nexus Mods',
                    value: `[View Mod Page ↗](${nexusModsTrackingUrl(`https://nexusmods.com/${modWithFiles.game.domainName}/mods/${modWithFiles.modId}/`, 'subscribedMod')})`,
                    inline: true
                }
            )
        }
        break;
        case SubscribedItemType.Collection: {
            const collection: EntityType<SubscribedItemType.Collection> = entity;
            const revision: ICollectionRevision = collection.revisions![0];
            embed.setColor('#2dd4bf')
            .setAuthor({
                name: collection.user.name,
                url: nexusModsTrackingUrl(`https://nexusmods.com/users/${collection.user.memberId}`, 'subscribedCollection'),
                iconURL: collection.user.avatar
            })
            .setTitle(`${collection.name} Revision ${revision.revisionNumber} is now available!`)
            .setDescription(
                `## Changelog\n`+
                (revision.collectionChangelog?.description?.length ? trimCollectionChangelog(revision.collectionChangelog.description, compact ? 500 : undefined) : '__Not provided__')
            )
            // .setURL(nexusModsTrackingUrl(`https://nexusmods.com/games/${collection.game.domainName}/collections/${collection.slug}`, 'subscribedCollection'))
            .setThumbnail(collection.tileImage?.url ?? null)
            .setTimestamp(new Date(revision.updatedAt))
            .setFooter({ text: `${collection.game.name}`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png' })
            .addFields(
                [
                    {
                        name: 'Mod Manager',
                        value: `[Download ↗](https://discordbot.nexusmods.com/nxm?type=collection&domain=${collection.game.domainName}&slug=${collection.slug}&rev=${revision.revisionNumber})`,
                        inline: true
                    },
                    {
                        name: 'Nexus Mods',
                        value: `[Revision ${revision.revisionNumber} ↗](${nexusModsTrackingUrl(`https://nexusmods.com/games/${collection.game.domainName}/collections/${collection.slug}/revisions/${revision.revisionNumber}`, 'subscribedCollection')})`,
                        inline: true
                    }
                ]
            )
        }
        break;
        case SubscribedItemType.User: {
            const userUrl = nexusModsTrackingUrl(`https://nexusmods.com/users/${entity.memberId}`, 'subscribedUser');
            switch (userEmbedType) {
                case UserEmbedType.NewMod: {
                    const userWithMod = entity as UserEntityType<UserEmbedType.NewMod>;
                    const mod = userWithMod.mod;
                    embed.setColor('#2dd4bf')
                    .setAuthor(
                        {
                            name: `${userWithMod.name} uploaded a new mod!`,
                            url: userUrl,
                            iconURL: userWithMod.avatar
                        }
                    )
                    .setTitle(`<:mod:${customEmojis.mod}> ${mod.name.slice(0, 225)}`)
                    .setDescription(`${mod.summary ?? '_No Summary_'}\n[View Mod ↗](${nexusModsTrackingUrl(`https://nexusmods.com/${mod.game.domainName}/mods/${mod.modId}`, 'subscribedUser')})`)
                    .setImage(compact ? null : mod.pictureUrl)
                    .setThumbnail(compact ? mod.pictureUrl : null)
                    .setFooter({ text: `${mod.game.name} • v${mod.version}`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png'})
                    .setTimestamp(new Date(mod.createdAt))
                }
                break;
                case UserEmbedType.UpdatedMod: {
                    const userWithMod = entity as UserEntityType<UserEmbedType.UpdatedMod>;
                    const mod = userWithMod.mod;
                    const file = mod.files?.length ? mod.files[0] : undefined;
                    const changelog: string | undefined = file?.changelogText.length ? trimModChangelog(file.changelogText, compact ? 500: 1000, logger) : undefined;
                    embed.setColor('#2dd4bf')
                    .setAuthor(
                        {
                            name: `${userWithMod.name} updated a mod!`,
                            url: userUrl,
                            iconURL: userWithMod.avatar
                        }
                    )
                    .setTitle(`<:mod:${customEmojis.mod}> ${mod.name.slice(0, 225)}`)
                    .setDescription(`${mod.summary ?? '_No Summary_'}\n[View Mod ↗](${nexusModsTrackingUrl(`https://nexusmods.com/${mod.game.domainName}/mods/${mod.modId}`, 'subscribedUser')})`)
                    .setImage(compact ? null : mod.pictureUrl)
                    .setThumbnail(compact ? mod.pictureUrl : null)
                    .setFooter({ text: `${mod.game.name} • v${mod.version}`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png'})
                    .setTimestamp(file?.date ? new Date(file.date * 1000) : new Date(mod.updatedAt))
                    if (changelog && changelog.length) embed.addFields({ name: 'Changelog', value: changelog });
                }
                break;
                case UserEmbedType.NewCollection: {
                    const userWithCollection = entity as UserEntityType<UserEmbedType.NewCollection>;
                    const collection = userWithCollection.collection;
                    embed.setColor('#2dd4bf')
                    .setAuthor(
                        {
                            name: `${userWithCollection.name} shared a new collection!`,
                            url: userUrl,
                            iconURL: userWithCollection.avatar
                        }
                    )
                    .setTitle(`<:collection:${customEmojis.collection}>  ${collection.name}`)
                    .setDescription(`${collection.summary ?? '_No Summary_'}\n[View Collection ↗](${nexusModsTrackingUrl(`https://nexusmods.com/games/${collection.game.domainName}/collections/${collection.slug}`, 'subscribedUser')})`)
                    .setImage(compact ? null : (collection.tileImage?.url ?? null))
                    .setThumbnail(compact ? (collection.tileImage?.url ?? null) : null)
                    .setFooter({ text: `${collection.game.name} • Revision ${assertPresent(collection.latestPublishedRevision, 'a published collection always has a published revision').revisionNumber}`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png'})
                    .setTimestamp(new Date(assertPresent(collection.latestPublishedRevision, 'a published collection always has a published revision').updatedAt))
                }
                break;
                case UserEmbedType.UpdatedCollection: {
                    const userWithCollection = entity as UserEntityType<UserEmbedType.UpdatedCollection>;
                    const collection = userWithCollection.collection;
                    embed.setColor('#2dd4bf')
                    .setAuthor(
                        {
                            name: `${userWithCollection.name} updated a collection!`,
                            url: userUrl,
                            iconURL: userWithCollection.avatar
                        }
                    )
                    .setTitle(`<:collection:${customEmojis.collection}>  ${collection.name}`)
                    .setDescription(`${collection.summary ?? '_No Summary_'}\n[View Collection ↗](${nexusModsTrackingUrl(`https://nexusmods.com/games/${collection.game.domainName}/collections/${collection.slug}`, 'subscribedUser')})`)
                    .setImage(compact ? null : (collection.tileImage?.url ?? null))
                    .setThumbnail(compact ? (collection.tileImage?.url ?? null) : null)
                    .setFooter({ text: `${collection.game.name} • Revision ${assertPresent(collection.latestPublishedRevision, 'a published collection always has a published revision').revisionNumber}`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png'})
                    .setTimestamp(new Date(assertPresent(collection.latestPublishedRevision, 'a published collection always has a published revision').updatedAt))
                    .addFields({ name: 'Changelog ↗', value: `[View](${nexusModsTrackingUrl(`https://www.nexusmods.com/games/${collection.game.domainName}/collections/${collection.slug}/changelog`, 'subscribedUser')})` })
                }
                break;
                case UserEmbedType.NewImage: {
                    embed.setDescription('Media updates have not been implemented yet.');
                }
                break;
                case UserEmbedType.NewVideo: {
                    embed.setDescription('Media updates have not been implemented yet.');
                }
                break;
                default: embed.setDescription(`Unknown user embed type: ${userEmbedType}`);
            }
        }
        break;
        default: embed.setDescription(`Unknown SubscribedItemType when building Embed: ${sub.type}`);

    }

    return embed;
}

export function unavailableUpdate<T extends SubscribedItemType>(entity: EntityType<T>, type: SubscribedItemType, sub: SubscribedItem<T>, newStatus: ModStatus | CollectionStatus): IPostableSubscriptionUpdate<T> {
    const embed = new EmbedBuilder();
    let date = new Date();
    if (type === SubscribedItemType.Mod) {
        newStatus = newStatus as ModStatus;
        const mod = entity as EntityType<SubscribedItemType.Mod>;
        date = typeof mod.updatedAt === 'string' ? new Date(mod.updatedAt) : mod.updatedAt;
        switch (newStatus) {
            case 'hidden': {
                embed.setTitle(`${mod.name} has been hidden`)
                .setDescription(
                    `The mod page has been temporarily hidden from viewing by the mod author, a team member, or a moderator.\n`+
                    `[More Info](${nexusModsTrackingUrl(`https://nexusmods.com/${mod.game.domainName}/mods/${mod.modId}`, 'subscribedMod')})`
                )
                .setColor('DarkGold')
                .setThumbnail(null)
            }
            break;
            case 'under_moderation': {
                embed.setTitle(`${mod.name} has been placed under moderator review`)
                .setDescription(
                    'The mod page is unavaialble while it is reviewed by a moderator. \n'+
                    'This mod may become available again, but it can take some time depending on the nature of the issue and how long the author takes to respond.'
                )
                .setColor('DarkRed')
                .setThumbnail(null)
            }
            break;
            case 'removed': {
                embed.setTitle(`${mod.name} has been deleted`)
                .setDescription(`The mod page has been deleted by the mod author or a team member. \nNo further updates will be posted.`)
                .setColor('Red')
                .setThumbnail(null)
            }
            break;
            case 'wastebinned': {
                embed.setTitle(`${mod.name} has been permanently removed`)
                .setDescription(`The mod page has been permanently deleted by a moderator for breaching the Nexus Mods Terms of Service. \nNo further updates will be posted.`)
                .setColor('Red')
                .setThumbnail(null)
            }
            break;
        }

    }
    else if (type === SubscribedItemType.Collection) {
        newStatus = newStatus as CollectionStatus;
        const collection = entity as EntityType<SubscribedItemType.Collection>;
        const publishedRevision = assertPresent(collection.latestPublishedRevision, 'a published collection always has a published revision');
        date = typeof publishedRevision.updatedAt === 'string' ? new Date(publishedRevision.updatedAt) : publishedRevision.updatedAt;
        switch (newStatus) {
            case 'under_moderation': {
                embed.setTitle(`${collection.name} has been placed under moderator review`)
                .setDescription(
                    'The collection page is unavaialble while it is reviewed by a moderator. \n'+
                    'This mod may become available again, but it can take some time depending on the nature of the issue and how long the author takes to respond.'
                )
                .setColor('DarkRed')
                .setThumbnail(null)
            }
            break;
            case 'discarded' : {
                embed.setTitle(`${collection.name} has been permanently removed`)
                .setDescription(`The collection page has been permanently deleted by a moderator for breaching the Nexus Mods Terms of Service. \nNo further updates will be posted.`)
                .setColor('Red')
                .setThumbnail(null)
            }
            break;
        }

    }

    return {
        type,
        date,
        embed: embed.data,
        entity,
        subId: sub.id,
        message: sub.message,
        crosspost: sub.crosspost ?? false,
    }
}

export function unavailableUserUpdate(entity: IUser, sub: SubscribedItem<SubscribedItemType.User>): IPostableSubscriptionUpdate<SubscribedItemType.User> {
    const embed = new EmbedBuilder()
    if (entity.deleted) {
        embed.setColor('DarkerGrey')
        .setTitle(`${sub.title} has deleted their account`)
        .setDescription(`You can no longer track updated for ${sub.title} as they have deleted their account.`);
    }
    else if (entity.banned) {
        embed.setColor('DarkRed')
        .setTitle(`${sub.title} has been banned`)
        .setDescription(`The user account ${sub.title} has been banned from Nexus Mods for breaching the community rules.\nMore details can be found in the [public bans forum](https://forums.nexusmods.com/forum/188-formal-warnings-bans-and-takedowns/).`)
    }

    return {
        entity,
        type: SubscribedItemType.User,
        date: new Date(),
        subId: sub.id,
        embed: embed.data,
        crosspost: sub.crosspost ?? false,
    }
}

// Cut to length and reformat any incompatible markdown
// Exported for tests. Not part of the module's public surface.
export function trimCollectionChangelog(markdown: string, maxLength: number = 2000): string {
    // Remove images by regex (anything inside ![...](...) will be removed)
    let modifiedMarkdown = markdown.replace(/!\[([^\]]*)\]\([^)]*\)/g, '');

    // Convert all headers to h3 by replacing headers with less than 3 # symbols
    modifiedMarkdown = modifiedMarkdown.replace(/^#{1,2} (.*)/gm, '### $1');

    // Extract only the text inside <summary> tags within <details> sections
    modifiedMarkdown = modifiedMarkdown.replace(/<details><summary>(.*?)<\/summary>[\s\S]*?<\/details>/g, '$1 (View full changelog to expand)');

    // Replace these weird HTML encoded spaces
    modifiedMarkdown = modifiedMarkdown.replace('&#x20;', '');

    // break into lines, then reduce to the max length 
    const newLines = modifiedMarkdown.split('\n');
    let trimmedMarkdown = '';
    for (const line of newLines) {

        const temp = `${trimmedMarkdown}\n${line}`;
        if (temp.length >= maxLength) {
            trimmedMarkdown += '...'
            break;
        }
        else trimmedMarkdown = temp;
    }

    return trimmedMarkdown; 

}

export function trimModChangelog(raw: string[], limit: number = 1000, logger: Logger): string {
    // THIS FEATURE IS BROKEN IN THE API, WE'LL CHECK IF IT'S STILL INVALID AND RETURN NULL IF IT IS.
    if (raw[0].startsWith('#<ModChangelog')) {
        logger.debug('Mod changelogs are still broken, returning a generic message.');
        return '_Changelog could not be rendered due to [an API bug](https://forums.nexusmods.com/topic/13512031-changelogs-on-the-modfiles-endpoint-are-not-showing-the-correct-data/). \n Please use the Logs tab on the mod page to view the changelog._';
    }
    let changelog = '';
    for (const line of raw) {
        const temp = changelog.length ? `${changelog}\n${line}` : line;
        if (temp.length >= limit) {
            changelog += '...';
            break;
        }
        else changelog = temp;
    }

    return changelog;
}
