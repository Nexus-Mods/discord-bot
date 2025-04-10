// Functionality to interact with the forum API
import dotenv from 'dotenv';
dotenv.config();

import { ForumTopic } from "../types/ForumWebhookTypes";
import axios from 'axios';

export async function getTopic(id: number): Promise<ForumTopic> {
    const APIKEY: string | undefined = process.env.FORUM_API_KEY;
    if (!APIKEY || !APIKEY.length) throw new Error('FORUM_API_KEY is not set in the environment variables.');
    const params = new URLSearchParams({ key: APIKEY });
    const forumsEndpoint = `https://forums.nexusmods.com/api/forums/topics/${id}?${params.toString()}`;

    const res = await axios.get<ForumTopic>(forumsEndpoint, {});
    if (res.status >= 200 && res.status < 300) return res.data;
    else {
        console.error('Error fetching topic:', { status: res.status, statusText: res.statusText });
        throw new Error(`Error fetching topic: ${res.status} ${res.statusText}`);
    }

    // const response = await fetch(forumsEndpoint, {
    //     method: 'GET',
    //     headers: {
    //         'Content-Type': 'application/json',
    //         'User-Agent': 'Nexus Mods Discord Bot',
    //         'Accept': '*/*'
    //     },
    // });

    // if (!response.ok) {
    //     console.error('Error fetching topic:', { body: (await response.text()).substring(0, 1000) });
    // }

    // return await response.json();
}