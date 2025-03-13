import { queryPromise } from './dbConnect';
import { logMessage } from './util';

async function getSavedNews(): Promise<{title: string, date: Date}> {
    try {
        const data = await queryPromise<{title: string, date: Date}>(
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

async function updateSavedNews(title: string, date: Date): Promise<boolean> {
    try {
        await queryPromise(
            'DELETE FROM news', 
            []
        );
        await queryPromise(
            'INSERT INTO news (title, date) VALUES ($1, $2)',
            [title, date]
        );
        return true;
    }
    catch(err) {
        logMessage('Error updating news', err, true);
        throw err;
    }
}

export { getSavedNews, updateSavedNews };