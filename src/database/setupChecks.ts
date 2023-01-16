import { queryPromise } from '../api/dbConnect';
import { logMessage } from '../api/util';
import userSetup from './users';

export async function setupDB() {

    // News Table
    try {
        await queryPromise('CREATE TABLE IF NOT EXISTS public.news (title character varying, date timestamp with time zone)', []);
    }
    catch(err) {
        logMessage('Error creating news table', err, true);
    }

    // User Table
    try {
        await userSetup();
    }
    catch(err) {
        logMessage('Error creating news table', err, true);
    }
    process.exit(1);

    // User Mods Table

    // Game Feeds Table

    // Mod Feeds Table

    // Servers Table

    // User Servers Table

    // Infos Table

    // Info Fields Table
}