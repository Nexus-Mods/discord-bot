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
        const data = await queryPromise('SELECT * FROM tips ORDER BY title', []);
        return data.rows as ITip[];
    }
    catch(error) {
        throw new Error(`Could not get Tips from database. ${(error as Error).message}`);
    }

}

async function addTip(prompt: string, author: string, title: string, embed?: string, message?: string): Promise<{id: number, prompt: string}> {
    try {
        const data = await queryPromise(
            'INSERT INTO tips (prompt, title, embed, message, author) VALUES ($1 , $2, $3, $4, $5) RETURNING id, prompt',
            [prompt, title, embed, message, author]
        );
        return data.rows[0];
    }
    catch(error) {
        throw new Error(`Could not add Tip to database. ${(error as Error).message}`);
    }
}

async function editTip(prompt: string, author: string, title: string, embed?: string, message?: string): Promise<void> {
    try {
        await queryPromise(
            'UPDATE tips SET title=$1, embed=$2, message=$3, author=$4, updated=DEFAULT WHERE prompt=$5',
            [title, embed, message, author, prompt]
        );
        return;
    }
    catch(error) {
        throw new Error(`Could not edit Tip in database. ${(error as Error).message}`);
    }
}

async function setApprovedTip(prompt: string, approved: boolean): Promise<void> {
    try {
        await queryPromise(
            'UPDATE tips SET approved=$1 WHERE prompt=$2',
            [prompt, approved]
        );
        return;
    }
    catch(error) {
        throw new Error(`Could not approve Tip in database. ${(error as Error).message}`);
    }
}

async function deleteTip(prompt: string): Promise<void> {
    try {
        await queryPromise(
            'DELETE FROM tips WHERE prompt=$1',
            [prompt]
        );
        return;
    }
    catch(error) {
        throw new Error(`Could not delete Tip from database: ${prompt}. ${(error as Error).message}`);
    }
}

export { addTip, editTip, setApprovedTip, deleteTip, getAllTips };