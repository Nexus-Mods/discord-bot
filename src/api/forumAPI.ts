// Functionality to interact with the forum API
import dotenv from 'dotenv';
dotenv.config();

import { ForumTopic } from "../types/ForumWebhookTypes";

export async function getTopic(id: number): Promise<ForumTopic> {
    const APIKEY: string | undefined = process.env.FORUM_API_KEY;
    if (!APIKEY || !APIKEY.length) throw new Error('FORUM_API_KEY is not set in the environment variables.');
    const params = new URLSearchParams({ key: APIKEY });
    const forumsEndpoint = `https://forums.nexusmods.com/api/forums/topics/${id}?${params.toString()}`;

    const response = await fetch(forumsEndpoint, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Nexus Mods Discord Bot',
            'Accept': '*/*'
        },
    });

    if (!response.ok) {
        const bodyText = await response.text();
        if (bodyText.includes('Cloudflare')) throw new Error('Cloudflare error, please try again later');
        else throw new Error('Error fetching topic: '+response.statusText);
    }

    return await response.json();
}