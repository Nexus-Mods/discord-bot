import { queryPromise } from './dbConnect';
import { logMessage } from './util';
import { SavedNewsData } from '../types/feeds';

async function getSavedNews(): Promise<SavedNewsData> {
    try {
        const data = await queryPromise<SavedNewsData>(
            'SELECT * FROM news',
            []
        )
        return data.rows[0];
    }
    catch(err) {
        logMessage('Error getting saved news', err, true);
        throw err;
    }
}

async function updateSavedNews(title: string, date: Date, id: number): Promise<boolean> {
    try {
        await queryPromise(
            'DELETE FROM news', 
            []
        );
        await queryPromise(
            'INSERT INTO news (title, date, id) VALUES ($1, $2, $3)',
            [title, date, id]
        );
        return true;
    }
    catch(err) {
        logMessage('Error updating news', err, true);
        throw err;
    }
}

async function ensureNewsDB() {
    try {
        await queryPromise(
            `CREATE TABLE IF NOT EXISTS public.news
            (
                title character varying COLLATE pg_catalog."default" NOT NULL,
                date timestamp with time zone NOT NULL,
                id integer NOT NULL
            )
            `,
            []
        );

    }
    catch(err) {
        logMessage('Error creating news table', err, true);
        throw err;
    }
}

export { getSavedNews, updateSavedNews, ensureNewsDB };