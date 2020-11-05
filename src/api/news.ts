import query from './dbConnect';
import { NewsArticle } from '../types/feeds';
import { QueryResult } from 'pg';

async function getSavedNews(): Promise<{title: string, date: Date}> {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM news', [], 
        (error: Error, results: QueryResult) => {
            if (error) reject(error);
            resolve(results.rows[0]);
        });
    });
}

const updateSavedNews = (newsArticle: NewsArticle) => {
    return new Promise((resolve, reject) => {
        query('DELETE FROM news', [], 
        (error: Error, results: QueryResult) => {
            if (error) return reject(error);
            query('INSERT INTO news (title, date) VALUES ($1, $2)', [newsArticle.title, newsArticle.pubDate], (error, results) => {
                if (error) return reject(error);
                resolve(true);
            });
        })
    });
}

export { getSavedNews, updateSavedNews };