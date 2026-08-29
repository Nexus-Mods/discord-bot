import { quicksearch, updatedMods, modInfo, modFiles as modFilesV1, modChangelogs, games as gamesV1, game as gameV1, validate } from './v1.js';
import { isModAuthor } from './v2-ismodauthor.js';
import { game } from './v2-game.js';
import { mods as modsById } from './v2-modsbymodid.js';
import { mods } from './v2-mods.js';
import { myCollections } from './v2-mycollections.js';
import { collections } from './v2-collections.js';
import { collection } from './v2-collection.js';
import { findUser } from './v2-finduser.js';
import { updatedMods as updatedModsV2 } from './v2-updatedMods.js';
import { latestMods } from './v2-latestmods.js';
import { news } from './v2-news.js';
import { modFiles } from './v2-modsFiles.js';
import { Games as gamesJSON, ModDownloads, SiteStats, WebsiteStatus } from './other.js';
import { modsByUid } from './v2-modsbyuid.js';
import { users } from './v2-users.js';
import { collectionRevisions } from './v2-collectionRevisions.js';

export const v1 = {
    validate,
    updatedMods,
    quicksearch,
    modInfo,
    modFiles: modFilesV1,
    modChangelogs,
    games: gamesV1,
    game: gameV1
};

export const v2 = {
    isModAuthor,
    game,
    mods,
    modsById,
    modsByUid,
    updatedMods: updatedModsV2,
    myCollections,
    collections,
    collection,
    findUser,
    latestMods,
    news,
    modFiles,
    users,
    collectionRevisions
};

export const other = {
    Games: gamesJSON,
    ModDownloads,
    SiteStats,
    WebsiteStatus
}