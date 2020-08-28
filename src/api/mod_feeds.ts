import query from './dbConnect';
import { ModFeed } from '../types/feeds';
import { QueryResult } from 'pg';

async function getAllModFeeds(): Promise<ModFeed[]> {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM mod_feeds', [], 
        (error: Error, result: QueryResult) => {
            if (error) return reject(error);
            resolve(result.rows);
        });
    });
}

async function getModFeed(feedId: number): Promise<ModFeed> {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM mod_feeds WHERE _id = $1', [feedId], 
        (error: Error, result: QueryResult) => {
            if (error) return reject(error);
            resolve(result.rows[0]);
        });
    });
}

async function getModFeedsForServer(serverId: string): Promise<ModFeed[]> {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM mod_feeds WHERE guild = $1', [serverId], 
        (error: Error, result: QueryResult) => {
            if (error) return reject(error);
            resolve(result.rows);
        });
    });
}

async function createModFeed(newFeed: ModFeed): Promise<number> {
    newFeed.created = new Date();
    return new Promise(
        (resolve, reject) => {
        query('INSERT INTO mod_feeds (channel, guild, owner, domain, mod_id, title, last_status, last_timestamp, created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [newFeed.channel, newFeed.guild, newFeed.owner, newFeed.domain, newFeed.mod_id, newFeed.title, newFeed.last_status, new Date(0), newFeed.created], 
        (error: Error, result: QueryResult) => {
            if (error) {
                //throw error;
                console.log(error);
                reject(error);
            };
            // GET THE ID FOR THIS FEED;
            query('SELECT _id FROM mod_feeds WHERE created = $1 AND owner = $2 AND mod_id = $3', [newFeed.created, newFeed.owner, newFeed.mod_id],
            (error: Error, result: QueryResult) => {
                if (error) return reject(error);
                return resolve(result.rows[0]._id);
            });
        })
    });
}

async function updateModFeed(feedId: number, newData: any): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
        let errors = 0;
        Object.keys(newData).forEach((key) => {
            query(`UPDATE mod_feeds SET ${key} = $1 WHERE _id = $2`, [newData[key], feedId], 
            (error: Error, result: QueryResult) => {
                if (error) errors += 1;
            });
        });
        if (errors > 0) resolve(false);
        else resolve(true);
    });
}

async function deleteModFeed(feedId: number): Promise<any> {
    return new Promise((resolve, reject) => {
        query('DELETE FROM mod_feeds WHERE _id = $1', [feedId], (error: Error, result: QueryResult) => {
            if (error) return reject(error);
            resolve(result.rows);
        });
    });
}

export { getAllModFeeds, getModFeed, getModFeedsForServer, createModFeed, updateModFeed, deleteModFeed };