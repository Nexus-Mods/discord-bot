import { quicksearch, updatedMods, modInfo, modFiles, modChangelogs, games as gamesV1, game as gameV1, validate } from './v1';
import { isModAuthor, IResult as IModAuthorResult } from './v2-ismodauthor';
import { games, IGame as IGameResult } from './v2-games';
import { game } from './v2-game';
import { mods as modsById } from './v2-modsbymodid';
import { mods } from './v2-mods';
import { myCollections } from './v2-mycollections';
import { collections } from './v2-collections';
import { collection } from './v2-collection';
import { collectionsByUser } from './v2-collectionsbyuser';
import { collectionsDownloadTotals } from './v2-collectionsdownloadtotals';
import { findUser, IUser } from './v2-finduser';
import { updatedMods as updatedModsV2 } from './v2-updatedMods';
import { latestMods } from './v2-latestmods';
import { ICollection, ICollectionSearchResult, IMod as IModResult } from './v2';

import { Games as gamesJSON, ModDownloads, SiteStats, WebsiteStatus } from './other';

export const v1 = {
    validate,
    updatedMods,
    quicksearch,
    modInfo,
    modFiles,
    modChangelogs,
    games: gamesV1,
    game: gameV1
};

export const v2 = {
    isModAuthor,
    game,
    games,
    mods,
    modsById,
    updatedMods: updatedModsV2,
    myCollections,
    collections,
    collection,
    collectionsByUser,
    collectionsDownloadTotals,
    findUser,
    latestMods
};

export const other = {
    Games: gamesJSON,
    ModDownloads,
    SiteStats,
    WebsiteStatus
}

export { IModAuthorResult, IGameResult, IModResult, ICollection, ICollectionSearchResult, IUser };