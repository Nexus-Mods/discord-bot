import axios, { AxiosError } from 'axios';
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord.js";
import { logMessage } from './util';

interface ISlackMessage {
    text: string;
    blocks: (ISlackSectionBlock | ISlackHeaderBlock | ISlackDividerBlock)[]
}

interface ISlackSectionBlock {
    type: 'section',
    text: {
        type: 'mrkdwn',
        text: string,
    }
    accessory?: {
        type: "image",
        image_url: string
        alt_text: string
    }
}

interface ISlackHeaderBlock {
    type: 'header',
    text: {
        type: 'plain_text',
        text: string,
    }
}

interface ISlackDividerBlock {
    type: 'divider'
}

export async function PublishToSlack(data: ISlackMessage): Promise<Boolean> {
    const slackWebhook: string = process.env['SLACK_WEBHOOK'] || '';

    if (!slackWebhook) throw new Error('Slack webhook is not provided!');

    try {
        await axios({
            method: 'POST',
            url: slackWebhook,
            data,
            transformResponse: (res) => JSON.parse(res),
            headers: { 
                'Content-Type': 'application/json'
            },
        });
        
        return true
    }
    catch(err) {
        logMessage('Error posting Slack Webhook', err, true);
        return false;
    }
}


export async function PublishToDiscord(data: RESTPostAPIWebhookWithTokenJSONBody): Promise<Boolean> {
    const discordWebhook: string = process.env['DISCORD_WEBHOOK'] || '';

    if (!discordWebhook) throw new Error('Discord webhook is not provided!');

    try {
        await axios({
            method: 'POST',
            url: discordWebhook,
            data,
            transformResponse: (res) => JSON.parse(res),
            headers: { 
                'Content-Type': 'application/json'
            },
        });
        
        return true
    }
    catch(err) {
        logMessage('Error posting Slack Webhook', err, true);
        return false;
    }
}
