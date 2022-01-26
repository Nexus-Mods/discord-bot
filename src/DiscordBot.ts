import { Client, Collection, Snowflake, ApplicationCommandData, Guild } from 'discord.js';
import { DiscordInteraction } from './types/util';
import * as fs from 'fs';
import path from 'path';

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
        
        this.client.config = require(path.join(__dirname, 'config.json'));
        this.setEventHandler();
        this.setCommands();
    }

    private setEventHandler(): void {
        fs.readdir(path.join(__dirname, 'events'), (err, files: string[]) => {
            if (err) return console.error(err);
            files.forEach((file: string) => {
                if (!file.endsWith('.js')) return;
                let event = require(path.join(__dirname, 'events', file));
                let eventName: string = file.split(".")[0];
                this.client.on(eventName, event.default.bind(null, this.client));
            });
        });
    }

    private setCommands(): void {
        if (!this.client.commands) this.client.commands = new Collection();
        fs.readdir(path.join(__dirname, 'commands'), (err, files : string[]) => {
            if (err) return console.error(err);
            files.forEach((file: string) => {
                if (!file.endsWith('.js')) return;
                let props = require(path.join(__dirname, 'commands', file));
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

        fs.readdir(path.join(__dirname, 'interactions'), (err, files: string[]) => {
            if (err) return console.error(err);

            let allCommands : ApplicationCommandData[] = []; //Collect all global commands
            let guildCommands : {[guild: string] : ApplicationCommandData[]} = {}; // Collect all guild-specific commands. 

            files.forEach(async (file: string) => {
                if (!file.endsWith('.js')) return;
                let interact: DiscordInteraction = require(path.join(__dirname, 'interactions', file)).discordInteraction;
                let interName: string = file.split('.')[0];

                // Add to global commands list.
                if (interact.public) allCommands.push(interact.command);
                // Add as guild specific command
                if (!!interact.guilds) {
                    for (const guild in interact.guilds) {
                        if (!guildCommands[interact.guilds[guild]]) guildCommands[interact.guilds[guild]] = [];
                        guildCommands[interact.guilds[guild]].push(interact.command);
                    }
                }
                this.client.interactions?.set(interName, interact);
            });

            // We've collected our commands, now we need to set them.

            // Set globally
            this.client.application?.commands.set(allCommands)
                .then(() => console.log(`Set global slash commands`, allCommands.map(c => c.name)))
                .catch(err => console.error('Failed to set global slash command list', err));

            
            // Set guild specific commands
            const guildToSet = Object.keys(guildCommands);

            for(const guildId of guildToSet) {
                const guildCommandList: ApplicationCommandData[] = guildCommands[guildId]
                // UNCOMMENT WHEN READY, FILER DUPLICATE PUBLIC COMMANDS (for testing we want them to duplicate due to the delay in updating commands in Discord).
                    .filter(c => !allCommands.find(gc => gc.name === c.name));

                const guild: Guild | undefined = this.client.guilds.cache.get(guildId as Snowflake);

                if (!guild) {
                    console.warn('Unable to set up slash commands for invalid guild', guildId);
                    continue;
                }

                if (!guildCommandList.length) {
                    console.log(`No non-global commands for ${guild?.name}, skipping.`);
                    guild.commands.set([]).catch(err => console.warn(`Unable to reset guild command list for ${guild.name}`, err));
                    continue;
                };
                
                guild.commands.set(guildCommandList)
                    .then(() => console.log(`Set guild slash commands for ${guild.name}`, guildCommandList.map(c => c.name)))
                    .catch(err => console.error(`Failed to set up guild slash commands for ${guild?.name}`, err))
            }
        });

        return;
    }
}

export interface ClientExt extends Client {
    config?: any;
    commands?: Collection<any, any>;
    interactions?: Collection<any, any>;
}