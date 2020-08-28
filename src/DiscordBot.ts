import { Client, Collection } from 'discord.js';
import * as fs from 'fs';

export class DiscordBot {
    private static instance: DiscordBot;

    private client: ClientExt = new Client();

    private constructor() {
        this.initializeClient();
    }

    static getInstance(): DiscordBot {
        if (!DiscordBot.instance) {
            DiscordBot.instance = new DiscordBot();
        }

        return DiscordBot.instance;
    }

    connect(): void {
        this.client
            .login(process.env.D_TOKEN)
            .then(() => console.log(`${new Date().toLocaleString()} - Connected to Discord`))
            .catch(err => 
                console.error(`${new Date().toLocaleString()} - Could not connect to Discord. Error: ${err.message}`)
            );
    }

    private initializeClient(): void {
        if (!this.client) return;
        
        this.client.config = require(`${__dirname}\\config.json`);
        this.setEventHandler();
        this.setCommands();
    }

    private setEventHandler(): void {
        fs.readdir(`${__dirname}\\events\\`, (err, files: string[]) => {
            if (err) return console.error(err);
            files.forEach((file: string) => {
                if (!file.endsWith('.js')) return;
                let event = require(`${__dirname}\\events\\${file}`);
                let eventName: string = file.split(".")[0];
                this.client.on(eventName, event.default.bind(null, this.client));
            });
        });
    }

    private setCommands(): void {
        if (!this.client.commands) this.client.commands = new Collection();
        fs.readdir(`${__dirname}/commands/`, (err, files : string[]) => {
            if (err) return console.error(err);
            files.forEach((file: string) => {
                if (!file.endsWith('.js')) return;
                let props = require(`${__dirname}/commands/${file}`);
                let commandName: string = file.split(".")[0];
                console.log(`Loading command: ${commandName}`);
                this.client.commands?.set(commandName, props);
            })
        });

    }
}

export interface ClientExt extends Client {
    config?: any;
    commands?: Collection<any, any>;
}