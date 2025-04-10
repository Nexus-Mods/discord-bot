// Functionality to interact with the forum API
import dotenv from 'dotenv';
dotenv.config();

import { ForumTopic } from "../types/ForumWebhookTypes";

export async function getTopic(id: number): Promise<ForumTopic> {
    const APIKEY: string | undefined = process.env.FORUM_API_KEY;
    if (!APIKEY || !APIKEY.length) throw new Error('FORUM_API_KEY is not set in the environment variables.');
    const response = await fetch(`https://forums.nexusmods.com/api/forums/topics/${id}?key=${APIKEY}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Nexus Mods Discord Bot',
            'Accept': '*/*'
        },
    });

    if (!response.ok) {
        console.error('Error fetching topic:', { body: (await response.text()).substring(0, 1000) });
    }

    return await response.json();
}