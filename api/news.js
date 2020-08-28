const { query } = require('./dbConnect.js');

const getSavedNews = () => {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM news', [], (error, results) => {
            if (error) reject(error);
            resolve(results.rows[0]);
        });
    });
}

const updateSavedNews = (newsArticle) => {
    return new Promise((resolve, reject) => {
        query('DELETE FROM news', [], (error, results) => {
            if (error) return reject(error);
            query('INSERT INTO news (title, date) VALUES ($1, $2)', [newsArticle.title, newsArticle.date], (error, results) => {
                if (error) return reject(error);
                resolve(true);
            });
        })
    });
}

module.exports = { getSavedNews, updateSavedNews };