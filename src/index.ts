const Discord = require("discord.js");
const Enmap = require("enmap");
const fs = require("fs");
const path = require('path');
require("dotenv").config();

//Setup the Discord Client
var client = new Discord.Client({sync: true, disabledEvents : ['TYPING_START',]});
const config = require("./config.json");
client.config = config;
exports.clientshared = client;

fs.readdir(path.join(__dirname, "./events/"), (err, files) => {
    if (err) return console.error(err);
    files.forEach(file => {
        const event = require(`./events/${file}`);
        let eventname = file.split(".")[0];
        client.on(eventname, event.bind(null, client));
    });
});

client.commands = new Enmap();

fs.readdir(path.join(__dirname, "./commands/"), (err, files) => {
    if (err) return console.error(err);
    files.forEach(file => {
        if (!file.endsWith(".js")) return;
        let props = require(`./commands/${file}`);
        let commandname = file.split(".")[0];
        console.log(`Loading command ${commandname}`);
        client.commands.set(commandname, props);
    });
});

client.login(process.env.TOKEN).catch((err) => console.error(`${new Date} - Bot startup failed: ${err.message}`));