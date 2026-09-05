import { query, withTransaction } from './dbConnect.js';
import type { Logger } from '@nexusmods/core/logger.js';
import type { SavedNewsData } from '../types/feeds.js';

async function getSavedNews(logger: Logger): Promise<SavedNewsData> {
    try {
        const data = await query<SavedNewsData>(
            'SELECT * FROM news',
            []
        )
        return data.rows[0];
    }
    catch(err) {
        logger.error('Error getting saved news', err, true);
        throw err;
    }
}

/**
 * Replace the stored news cursor.
 *
 * The DELETE and the INSERT have to be one transaction. As two separate statements,
 * a crash or a failed INSERT between them left the table empty, and an empty table
 * is not "no news yet" to the caller - the next poll found no cursor and treated
 * every existing article as new, so the feed reposted its whole backlog.
 */
async function updateSavedNews(logger: Logger, title: string, date: Date, id: number): Promise<boolean> {
    try {
        await withTransaction(async (tx) => {
            await tx('DELETE FROM news', []);
            await tx(
                'INSERT INTO news (title, date, id) VALUES ($1, $2, $3)',
                [title, date, id],
            );
        });
        return true;
    }
    catch(err) {
        logger.error('Error updating news', err, true);
        throw err;
    }
}

export { getSavedNews, updateSavedNews };
