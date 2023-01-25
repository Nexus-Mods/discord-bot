import axois from 'axios';
import { logMessage } from '../util';

interface IGame {
    approved_date: number;
    collections: number;
    domain_name: string;
    downloads: number;
    file_count: number;
    forum_url: string;
    genre: string;
    id: number;
    mods: number;
    name: string;
    name_lower: string;
    nexusmods_url: string;
}

const staticGamesList = 'https://data.nexusmods.com/file/nexus-data/games.json';

export async function Games(headers: Record<string, string>): Promise<IGame[]> {
    try {
        const gameList: IGame[] = await axois({
            url: staticGamesList,
            transformResponse: (res) => JSON.parse(res),
            headers: { 
                'Application-Name': headers['Application-Name'] , 
                'Application-Version': headers['Application-Version'] 
            },
        });
        return gameList;
    }
    catch(err) {
        logMessage('Error getting games list from static file', err, true);
        return [];
    }
}