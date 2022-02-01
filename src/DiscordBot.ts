import { Client, Collection, Snowflake, ApplicationCommandData, ApplicationCommand, Guild, ApplicationCommandPermissionData } from 'discord.js';
import { DiscordInteraction } from './types/util';
import * as fs from 'fs';
import path from 'path';
import { logMessage } from './api/util';

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
            .then(async () => {
                logMessage('Connected to Discord');
                await this.client.application?.fetch();
                this.setSlashCommands();
            })
            .catch(err => {
                logMessage(`Could not connect to Discord. Error: ${err.message}`);
                process.exit();
            });
    }

    private initializeClient(): void {
        if (!this.client) return;
        
        this.client.config = require(path.join(__dirname, 'config.json'));
        this.client.application?.fetch();
        this.setEventHandler();
        this.setCommands();
    }

    private setEventHandler(): void {
        try {
            const events: string[] = fs.readdirSync(path.join(__dirname, 'events'));
            events.filter(e => e.endsWith('.js')).forEach((file) => {
                const event = require(path.join(__dirname, 'events', file));
                const eventName: string = file.split(".")[0];
                this.client.on(eventName, event.default.bind(null, this.client));
            });
            logMessage('Registered to receive events:', events.map(e => path.basename(e, '.js')).join(', '));
        }
        catch(err) {
            return logMessage('Error reading events directory during startup.', err, true);
        }
    }

    private setCommands(): void {
        if (!this.client.commands) this.client.commands = new Collection();

        try {
            const commands: string[] = fs.readdirSync(path.join(__dirname, 'commands'));
            commands.filter(f => f.endsWith('.js')).forEach((file: string) => {
                const props = require(path.join(__dirname, 'commands', file));
                const commandName: string = file.split(".")[0];
                this.client.commands?.set(commandName, props);
            });
            logMessage('Registered text commands', this.client.commands.size);
        }
        catch (err) {
            return logMessage('Error reading commands directory during startup.', err, true);
        }

    }

    private async setSlashCommands(): Promise<void> {
        logMessage('Settings slash commands');
        if (!this.client.interactions) this.client.interactions = new Collection();
        if (!this.client.application?.owner) await this.client.application?.fetch();

        const interactionFiles: string[] = fs.readdirSync(path.join(__dirname, 'interactions'))
            .filter(i => i.toLowerCase().endsWith('.js'));
        
        let allCommands : ApplicationCommandData[] = []; //Collect all global commands
        let guildCommands : {[guild: string] : ApplicationCommandData[]} = {}; // Collect all guild-specific commands. 
        let allInteractions : DiscordInteraction[] = [];
        
        interactionFiles.forEach(async (file: string) => {
            let interact: DiscordInteraction = require(path.join(__dirname, 'interactions', file)).discordInteraction;
            allInteractions.push(interact);
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
            .then((commands: Collection<any, ApplicationCommand<any>>) => {
                logMessage(`Set global slash commands`, commands.map(c => c.name));
                // Permissions could be set here? 
            })
            .catch(err => logMessage('Failed to set global slash command list', {err}, true));

        
        // Set guild specific commands
        const guildToSet = Object.keys(guildCommands);

        for(const guildId of guildToSet) {
            const guildCommandList: ApplicationCommandData[] = guildCommands[guildId]
            // UNCOMMENT WHEN READY, FILER DUPLICATE PUBLIC COMMANDS (for testing we want them to duplicate due to the delay in updating commands in Discord).
                .filter(c => !allCommands.find(gc => gc.name === c.name));

            const guild: Guild | undefined = this.client.guilds.cache.get(guildId as Snowflake);

            if (!guild) {
                logMessage('Unable to set up slash commands for invalid guild', {guildId}, true);
                continue;
            }

            if (!guildCommandList.length) {
                logMessage(`No non-global commands for ${guild?.name}, skipping.`);
                guild.commands.set([]).catch(err => logMessage(`Unable to reset guild command list for ${guild.name}`, err, true));
                continue;
            };
            
            guild.commands.set(guildCommandList)
                .then(() => logMessage(`Set guild slash commands for ${guild.name}`, guildCommandList.map(c => c.name)))
                .catch(err => logMessage(`Failed to set up guild slash commands for ${guild?.name}`, err, true));
        }

        return;
    }
}

export interface ClientExt extends Client {
    config?: any;
    commands?: Collection<any, any>;
    interactions?: Collection<any, any>;
}