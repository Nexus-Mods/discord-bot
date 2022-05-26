import { QueryResult } from 'pg';
import { GameFeed } from '../types/feeds';
import query from './dbConnect';

function getAllGameFeeds(): Promise<GameFeed[]> {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM game_feeds', [], 
            (error: Error, result?: QueryResult) => {
                if (error) return reject(error);
                resolve(result?.rows || []);
            });
    });
}

function getGameFeed(feedId: number): Promise<GameFeed> {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM game_feeds WHERE _id = $1', [feedId], 
            (error: Error, result?: QueryResult) => {
                if (error) return reject(error);
                resolve(result?.rows[0]);
            });
    });
}

function getGameFeedsForServer(serverId: string): Promise<GameFeed[]> {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM game_feeds WHERE guild = $1', [serverId], 
            (error: Error, result?: QueryResult) => {
                if (error) return reject(error);
                resolve(result?.rows || []);
            });
    });
}

function createGameFeed (newFeed: Partial<GameFeed>): Promise<number> {
    // Get a timestamp that was 2 days ago
    const startTime: Date = new Date();
    startTime.setDate(startTime.getDate() - 2);
    return new Promise(
        (resolve, reject) => {
        query('INSERT INTO game_feeds (channel, guild, owner, domain, title, nsfw, sfw, show_new, show_updates, webhook_id, webhook_token, last_timestamp, created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
        [newFeed.channel, newFeed.guild, newFeed.owner, newFeed.domain, newFeed.title, newFeed.nsfw, newFeed.sfw, newFeed.show_new, newFeed.show_updates, newFeed.webhook_id, newFeed.webhook_token, startTime, new Date()], 
        (error: Error, results) => {
            if (error) {
                //throw error;
                console.error(error);
                return reject('Error creating game feed.'+error);
            };
            // GET THE ID FOR THIS FEED;
            query('SELECT _id FROM game_feeds WHERE webhook_id = $1 AND webhook_token = $2', [newFeed.webhook_id, newFeed.webhook_token],
            (error: Error, indexResult?: QueryResult) => {
                if (error) {
                    console.error(error);
                    return reject(`Error creating game feed. ${error.message}`);
                }
                else if (!indexResult?.rows || !indexResult?.rows.length) {
                    console.error(`Could not retrieve feed id for ${newFeed.title}, setup failed.`);
                    return reject(`Error creating game feed. ID could not be retrieved, saving may have failed.`);
                }
                else return resolve(indexResult?.rows[0]._id);
            });
        })
    });
}

function updateGameFeed(feedId: number, newData: any): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
        let errors = 0;
        Object.keys(newData).forEach((key) => {
            query(`UPDATE game_feeds SET ${key} = $1 WHERE _id = $2`, [newData[key], feedId], 
                (error: Error, results) => {
                    if (error) {
                        errors += 1;
                    };
                });
        });
        if (errors > 0) resolve(false);
        else resolve(true);
    });
}

function deleteGameFeed (feedId: number): Promise<any> {
    return new Promise((resolve, reject) => {
        query('DELETE FROM game_feeds WHERE _id = $1', [feedId], 
            (error: Error,result?: QueryResult) => {
                if (error) return reject(error);
                resolve(result?.rows);
            });
    });
}

export { getAllGameFeeds, getGameFeed, getGameFeedsForServer, createGameFeed, updateGameFeed, deleteGameFeed };