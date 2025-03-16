import { GameFeed } from '../types/feeds';
import query from './dbConnect';

async function getAllGameFeeds(): Promise<GameFeed[]> {
    try {
        const result = await query<GameFeed>('SELECT * FROM game_feeds', [], 'GetAllGameFeeds');
        return result.rows;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getGameFeed(feedId: number): Promise<GameFeed> {
    try {
        const result = await query<GameFeed>('SELECT * FROM game_feeds WHERE _id = $1', [feedId], 'GetGameFeed');
        return result.rows[0];
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getGameFeedsForServer(serverId: string): Promise<GameFeed[]> {
    try {
        const result = await query<GameFeed>('SELECT * FROM game_feeds WHERE guild = $1', [serverId], 'GetGameFeedsForServer');
        return result.rows;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function createGameFeed(newFeed: Partial<GameFeed>): Promise<number> {
    const startTime: Date = new Date();
    startTime.setDate(startTime.getDate() - 2);

    try {
        await query('INSERT INTO game_feeds (channel, guild, owner, domain, title, nsfw, sfw, show_new, show_updates, webhook_id, webhook_token, last_timestamp, created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)', 
            [newFeed.channel, newFeed.guild, newFeed.owner, newFeed.domain, newFeed.title, newFeed.nsfw, newFeed.sfw, newFeed.show_new, newFeed.show_updates, newFeed.webhook_id, newFeed.webhook_token, startTime, new Date()], 
            'CreateGameFeed'
        );

        const result = await query<{ _id: number }>('SELECT _id FROM game_feeds WHERE webhook_id = $1 AND webhook_token = $2', 
            [newFeed.webhook_id, newFeed.webhook_token], 'RetrieveFeedIdAfterCreation'
        );

        if (result.rows.length === 0) {
            throw new Error(`Could not retrieve feed id for ${newFeed.title}, setup failed.`);
        }

        return result.rows[0]._id;
    } catch (error) {
        return Promise.reject(`Error creating game feed: ${error}`);
    }
}

async function updateGameFeed(feedId: number, newData: Partial<GameFeed>): Promise<void> {
    try {
        const valuesToChange = Object.keys(newData);
        const setClause = valuesToChange.map((v, i) => `${v} = $${i + 1}`).join(', ');
        const queryText = `UPDATE game_feeds SET ${setClause} WHERE _id = $${valuesToChange.length + 1}`;
        const variables = [...Object.values(newData), feedId];

        await query(queryText, variables, 'UpdateGameFeed');
    } catch (error) {
        return Promise.reject(error);
    }
}

async function deleteGameFeed(feedId: number): Promise<void> {
    try {
        await query('DELETE FROM game_feeds WHERE _id = $1', [feedId], 'DeleteGameFeed');
    } catch (error) {
        return Promise.reject(error);
    }
}

export { getAllGameFeeds, getGameFeed, getGameFeedsForServer, createGameFeed, updateGameFeed, deleteGameFeed };
