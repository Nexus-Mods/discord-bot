// Functionality to interact with the forum API

import { ForumTopic } from "../types/ForumWebhookTypes";

export async function getTopic(id: number): Promise<ForumTopic> {
    if (!process.env.FORUM_API_KEY) throw new Error('FORUM_API_KEY is not set in the environment variables.');
    const response = await fetch(`https://forums.nexusmods.com/api/forums/topics/${id}?key=${process.env.FORUM_API_KEY}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.FORUM_API_KEY}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Error fetching topic: ${response.statusText}`);
    }

    return await response.json();
}