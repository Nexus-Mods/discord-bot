import query from './dbConnect';
import { PostableInfo, InfoResult } from '../types/util';
import { QueryResult } from 'pg';
import { Client, Message, MessageEmbed } from 'discord.js';

async function getAllInfos(): Promise<InfoResult[]> {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM infos', [], 
        (error: Error, result: QueryResult) => {
            if (error) return reject(error);
            resolve(result.rows);
        });
    });
}

async function createInfo(infoData: InfoResult): Promise<InfoResult> {
    return new Promise((resolve, reject) => {
        query('INSERT INTO infos (name, message, title, description, url, timestamp, thumbnail, image, fields, author) VALUES ($1 , $2, $3, $4, $5, $6, $7, $8, $9, $10)', 
        [infoData.name, infoData.message, infoData.title, infoData.description, infoData.url, infoData.timestamp, infoData.thumbnail, infoData.image, infoData.fields, infoData.author], 
        (error: Error, result: QueryResult) => {
            if (error) return reject(error);
            infoData.approved = false;
            resolve(infoData);
        });
    })
}

async function deleteInfo(infoName: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        query('DELETE FROM infos WHERE name = $1', [infoName], 
        (error: Error, result: QueryResult) => {
            if (error) return reject(error);
            resolve(true);
        });
    });
}

async function editInfo(infoName: string, newData: any): Promise<void> {
    //return new Promise(())
}

function displayInfo(client: Client, message: Message, info: InfoResult): PostableInfo {
    let result: PostableInfo = { content: info.message || '' };
    
    if (!info.approved) return { content: `Info for ${info.title || info.name} is pending moderator approval.` };
    

    if (!info.description && !info.url && !info.fields && !info.image && !info.thumbnail && !info.url) {
        // Doesn't appear to be an embed.
        return result;
    }

    const infoEmbed = new MessageEmbed()
    .setFooter(`Added by ${info.author || '???'} - ${message.author.tag}: ${message.cleanContent}`,client.user?.avatarURL() || '')
    .setTimestamp(info.timestamp || new Date())
    .setColor(0xda8e35);
    if (info.title) infoEmbed.setTitle(info.title);
    if (info.description) infoEmbed.setDescription(info.description);
    if (info.url) infoEmbed.setURL(info.url);
    if (info.thumbnail) infoEmbed.setThumbnail(info.thumbnail);
    if (info.image) infoEmbed.setImage(info.image);
    if (info.fields) info.fields.map(field => infoEmbed.addField(field.name, field.value, field.inline));
    result.embed = infoEmbed;
    return result;
}

export { getAllInfos, createInfo, deleteInfo, displayInfo };