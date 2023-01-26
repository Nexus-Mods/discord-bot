import { quicksearch, updatedMods, modInfo, modFiles, modChangelogs, games as gamesV1, game as gameV1 } from './v1';
import { isModAuthor, IResult as IModAuthorResult } from './v2-ismodauthor';
import { games, IGame as IGameResult } from './v2-games';
import { mods, IMod as IModResult } from './v2-modsbymodid';
import { myCollections } from './v2-mycollections';
import { collections } from './v2-collections';
import { collection } from './v2-collection';
import { collectionsByUser } from './v2-collectionsbyuser';
import { findUser, IUser } from './v2-finduser';
import { ICollection, ICollectionSearchResult } from './v2';

import { Games as gamesJSON } from './other';

export const v1 = {
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
    games,
    mods,
    myCollections,
    collections,
    collection,
    collectionsByUser,
    findUser
};

export const other = {
    Games: gamesJSON
}

export { IModAuthorResult, IGameResult, IModResult, ICollection, ICollectionSearchResult, IUser };