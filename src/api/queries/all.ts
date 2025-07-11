import { quicksearch, updatedMods, modInfo, modFiles as modFilesV1, modChangelogs, games as gamesV1, game as gameV1, validate } from './v1';
import { isModAuthor } from './v2-ismodauthor';
import { game } from './v2-game';
import { mods as modsById } from './v2-modsbymodid';
import { mods } from './v2-mods';
import { myCollections } from './v2-mycollections';
import { collections } from './v2-collections';
import { collection } from './v2-collection';
import { collectionsDownloadTotals } from './v2-collectionsdownloadtotals';
import { findUser } from './v2-finduser';
import { updatedMods as updatedModsV2 } from './v2-updatedMods';
import { latestMods } from './v2-latestmods';
import { news } from './v2-news';
import { modFiles } from './v2-modsFiles';
import { Games as gamesJSON, ModDownloads, SiteStats, WebsiteStatus } from './other';
import { modsByUid } from './v2-modsbyuid';
import { users } from './v2-users';
import { collectionRevisions } from './v2-collectionRevisions';
import { createCollectionChangelog } from './v2-createCollectionChangelog';

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
    collectionsDownloadTotals,
    findUser,
    latestMods,
    news,
    modFiles,
    users,
    collectionRevisions,
    createCollectionChangelog
};

export const other = {
    Games: gamesJSON,
    ModDownloads,
    SiteStats,
    WebsiteStatus
}