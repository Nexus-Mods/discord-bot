import { queryPromise } from './dbConnect';

export interface ITip {
    id: number;
    prompt: string;
    title: string;
    embed: string | null;
    message: string | null;
    created: string;
    updated: string;
    author: string;
    approved: boolean;
}

async function getAllTips(): Promise<ITip[]> {
    try {
        const data = await queryPromise('SELECT * FROM tips', []);
        return data.rows as ITip[];
    }
    catch(error) {
        throw new Error(`Could not get Tips from database. ${(error as Error).message}`);
    }

}

async function addTip(prompt: string, author: string, title: string, embed?: string, message?: string): Promise<{id: number, code: string}> {
    try {
        const data = await queryPromise(
            'INSERT INTO tips (prompt, title, embed, message, author) VALUES ($1 , $2, $3, $4, $5) RETURNING id',
            [prompt, title, embed, message, author]
        );
        return data.rows[0];
    }
    catch(error) {
        throw new Error(`Could not add Tip to database. ${(error as Error).message}`);
    }
}

async function deleteTip(code: string): Promise<void> {
    try {
        await queryPromise(
            'DELETE FROM tips WHERE code=$1',
            [code]
        );
        return;
    }
    catch(error) {
        throw new Error(`Could not delete Tip from database: ${code}. ${(error as Error).message}`);
    }
}

export { addTip, deleteTip, getAllTips };