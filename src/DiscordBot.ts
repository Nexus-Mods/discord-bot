import { Client, Collection, ApplicationCommand, Snowflake } from 'discord.js';
import { DiscordInteraction } from './types/util';
import * as fs from 'fs';

export class DiscordBot {
    private static instance: DiscordBot;

    private client: ClientExt = new Client({ intents: ['GUILDS', 'DIRECT_MESSAGES', 'GUILD_MESSAGES', 'GUILD_WEBHOOKS', 'GUILD_MESSAGE_REACTIONS', 'GUILD_INTEGRATIONS']});

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
            .then(() => {
                console.log(`${new Date().toLocaleString()} - Connected to Discord`);
                this.setSlashCommands();
            })
            .catch(err => {
                console.error(`${new Date().toLocaleString()} - Could not connect to Discord. Error: ${err.message}`);
                process.exit();
            });
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

    private async setSlashCommands(): Promise<void> {
        console.log('Settings slash commands');
        if (!this.client.interactions) this.client.interactions = new Collection();
        if (!this.client.application?.owner) await this.client.application?.fetch();

        fs.readdir(`${__dirname}\\interactions\\`, (err, files: string[]) => {
            if (err) return console.error(err);
            files.forEach(async (file: string) => {
                if (!file.endsWith('.js')) return;
                let interact: DiscordInteraction = require(`${__dirname}\\interactions\\${file}`).discordInteraction;
                let interName: string = file.split('.')[0];
                if (interact.public) await this.client.application?.commands.create(interact.command);
                else if (!!interact.guilds) {
                    for (const guild in interact.guilds) {
                        // console.log('Setting guild command', { id: interact.guilds[guild], command: interName })
                        await this.client.guilds.cache.get(interact.guilds[guild] as Snowflake)?.commands.create(interact.command);
                    }
                }
                this.client.interactions?.set(interName, interact);
                console.log(`Registered Slash Command: ${interName}`);
            });
        });

        return;
    }
}

export interface ClientExt extends Client {
    config?: any;
    commands?: Collection<any, any>;
    interactions?: Collection<any, any>;
}