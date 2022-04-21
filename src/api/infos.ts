import query from './dbConnect';
import { PostableInfo, InfoResult } from '../types/util';
import { QueryResult } from 'pg';
import { Client, Message, MessageEmbed, EmbedFieldData, User } from 'discord.js';

async function getAllInfos(): Promise<InfoResult[]> {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM infos', [], 
        (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            query('SELECT * FROM infos_fields', [], (fielderror: Error, fieldresult?: QueryResult) => {
                if (fielderror) return reject(fielderror);
                const fields = fieldresult?.rows || [];
                const infos: InfoResult[] = result ? result.rows.map(info => {
                    info.fields = fields
                    .filter(field => field.info_id === info.name)
                    .sort((a,b) => a.priority >= b.priority ? 1 : -1);
                    return info;
                }) : [];
                return resolve(infos);
            });
        });
    });
}

async function createInfo(infoData: InfoResult): Promise<InfoResult> {
    return new Promise((resolve, reject) => {
        query('INSERT INTO infos (name, message, title, description, url, thumbnail, image, author, approved) VALUES ($1 , $2, $3, $4, $5, $6, $7, $8, $9)', 
        [infoData.name, infoData.message, infoData.title, infoData.description, infoData.url, infoData.thumbnail, infoData.image, infoData.author, infoData.approved || false], 
        (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            infoData.approved = false;
            if (infoData.fields) return addFieldsBatch(infoData.name, infoData.fields)
                .then(() => resolve(infoData))
                .catch((err) => reject(err));
            else return resolve(infoData);
        });
    });
}

async function addField(infoId: string, field: EmbedFieldData, priority: number) {
    return new Promise((resolve, reject) => {
        query('INSERT INTO infos_fields (info_id, name, value, inline, priority) VALUES ($1, $2, $3, $4, $5)', 
            [infoId, field.name, field.value, field.inline || false, priority], 
            (error: Error, result?: QueryResult) => {
                if (error) return reject(error);
                return resolve(field);
            }
        );
    })
}

async function addFieldsBatch(infoId: string, fields: EmbedFieldData[]) {
    // Replaced function with one that works more logically.
    return Promise.all(fields.map((field: EmbedFieldData, index: number) => addField(infoId, field, index)));
}

async function deleteInfo(infoName: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        query('DELETE FROM infos WHERE name = $1', [infoName], 
        (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            resolve(true);
        });
    });
}

async function editInfo(infoName: string, newData: any): Promise<void> {
    //return new Promise(())
}

function displayInfo(client: Client, info: InfoResult, userToPing: User | null): PostableInfo {
    let result: PostableInfo = { content: userToPing ? `${userToPing.toString()} ${info.message || ''}` : info.message, embeds: [] };
    
    if (!info.approved) return { content: `Info for "${info.title || info.name}" is pending moderator approval.` };
    

    if (!info.description && !info.url && !info.fields && !info.image && !info.thumbnail && !info.url) {
        // Doesn't appear to be an embed.
        return result;
    }

    const infoEmbed = new MessageEmbed()
    .setFooter({text:`Info added by ${info.author || '???'}`, iconURL: client.user?.avatarURL() || '' })
    .setTimestamp(info.timestamp || new Date())
    .setColor(0xda8e35);
    if (info.title) infoEmbed.setTitle(info.title);
    if (info.description) infoEmbed.setDescription(addBreaks(info.description));
    if (info.url) infoEmbed.setURL(info.url);
    if (info.thumbnail) infoEmbed.setThumbnail(info.thumbnail);
    if (info.image) infoEmbed.setImage(info.image);
    if (info.fields) info.fields.map(field => infoEmbed.addField(field.name, field.value, field.inline));
    result.embeds?.push(infoEmbed);
    return result;
}

function addBreaks(text: string): string {
    let result = text;
    while (result.includes('\\n')) {
        result = result.replace('\\n', '\n')
    }
    return result;
}

export { getAllInfos, createInfo, deleteInfo, displayInfo };