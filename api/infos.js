const { query } = require('./dbConnect.js');
const Discord = require('discord.js');

const getAllInfos = () => {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM infos', [], (error, result) => {
            if (error) return reject(error);
            resolve(result.rows);
        });
    });
}

const createInfo = (infoData) => {
    return new Promise((resolve, reject) => {
        query('INSERT INTO infos (name, message, title, description, url, timestamp, thumbnail, image, fields, author) VALUES ($1 , $2, $3, $4, $5, $6, $7, $8, $9, $10)', 
        [infoData.name, infoData.message, infoData.title, infoData.description, infoData.url, infoData.timestamp, infoData.thumbnail, infoData.image, infoData.fields, infoData.author], (error, result) => {
            if (error) return reject(error);
            infoData.approved = false;
            resolve(infoData);
        });
    })
}

const deleteInfo = (infoName) => {
    return new Promise((resolve, reject) => {
        query('DELETE FROM infos WHERE name = $1', [infoName], (error, result) => {
            if (error) return reject(error);
            resolve(true);
        });
    });
}

const editInfo = (infoName, newData) => {
    //return new Promise(())
}

const displayInfo = (client, message, info) => {
    if (!info.approved) return message.channel.send(`Info for ${info.title || info.name} is pending moderator approval.`).catch(err => console.error('Failed to send info', message.guild.name, err));

    if (!info.description && !info.url && !info.fields && !info.image && !info.thumbnail && !info.url) {
        // Doesn't appear to be an embed.
        if (info.message) return message.channel.send(info.message);
        else console.error('Tried to send invalid info.', info);
    }

    const infoEmbed = new Discord.RichEmbed()
    .setFooter(`Added by ${info.author || '???'} - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL)
    .setTimestamp(info.timestamp || new Date())
    .setColor(0xda8e35);
    if (info.title) infoEmbed.setTitle(info.title);
    if (info.description) infoEmbed.setDescription(info.description);
    if (info.url) infoEmbed.setURL(info.url);
    if (info.thumbnail) infoEmbed.setThumbnail(info.thumbnail);
    if (info.fields) info.fields.map(field => infoEmbed.addField(field.name, field.value, field.inline));
    return message.channel.send(info.message || '', infoEmbed).catch(err => console.error('Failed to send info', message.guild.name, err));;
}

module.exports = { getAllInfos, createInfo, deleteInfo, displayInfo };

/*
Structure of the DB for Infos
name, //Lookup name
message, //Message to respond with
title, //title of the embed and/or summary of the topic
description, //embed description
url, //embed url
timestamp, //time created
thumbnail, //thumbnail for embed
image, //image for embed
fields, //array of embed fields
approved //approval status
author //who wrote this info.
*/