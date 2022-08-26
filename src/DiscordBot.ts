import { Client, Collection, ApplicationCommandData, GatewayIntentBits, Routes, Snowflake, IntentsBitField } from 'discord.js';
import { REST } from '@discordjs/rest';
import * as fs from 'fs';
import path from 'path';
import { logMessage } from './api/util';
import { DiscordEventInterface, DiscordInteraction, ClientExt } from './types/DiscordTypes';

// const intents: GatewayIntentBits[] = [
//     GatewayIntentBits.Guilds, 
//     GatewayIntentBits.DirectMessages, 
//     GatewayIntentBits.GuildMessages,
//     GatewayIntentBits.GuildMembers,
//     GatewayIntentBits.GuildWebhooks,
//     GatewayIntentBits.GuildMessageReactions,
//     GatewayIntentBits.GuildIntegrations
// ];

const intents: GatewayIntentBits[] = [
    IntentsBitField.Flags.Guilds, IntentsBitField.Flags.DirectMessages,
    IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.GuildWebhooks,
    IntentsBitField.Flags.GuildMessageReactions, IntentsBitField.Flags.GuildIntegrations
];

export class DiscordBot {
    private static instance: DiscordBot;

    private token: Snowflake = process.env.D_TOKEN as Snowflake;
    private clientId: Snowflake = process.env.CLIENT_ID as Snowflake;
    private client: ClientExt = new Client({ intents });
    private rest: REST = new REST({ version: '10' }).setToken(this.token);

    private constructor() {
        this.initializeClient();
    }

    static getInstance(): DiscordBot {
        if (!DiscordBot.instance) {
            DiscordBot.instance = new DiscordBot();
        }

        return DiscordBot.instance;
    }

    private initializeClient(): void {
        if (!this.client) return logMessage('Could not initialise DiscordBot, client is not defined.', {}, true);
        
        this.client.config = require(path.join(__dirname, 'config.json'));
        this.client.application?.fetch();
        this.setEventHandler();
    }

    public async connect(): Promise<void> {
        logMessage('Attempting to log in.')
        try {
            await this.client.login(this.token);
            logMessage('Connected to Discord');
            await this.client.application?.fetch();
        }
        catch(err) {
            logMessage('Failed to connect to Discord during bot setup', { error: (err as Error).message }, true);
            return process.exit();
        }
    }

    public async setupInteractions(): Promise<void> {
        try {
            await this.setInteractions();
        }
        catch(err) {
            logMessage('Failed to set interactions', err, true);
        }
    }

    private setEventHandler(): void {
        try {
            const events: string[] = fs.readdirSync(path.join(__dirname, 'events'));
            events.filter(e => e.endsWith('.js')).forEach((file) => {
                const event: DiscordEventInterface = require(path.join(__dirname, 'events', file)).default;
                const eventName: string = file.split(".")[0];
                if (!event.execute) return;
                if (event.once) this.client.once(eventName, event.execute.bind(null, this.client));
                else this.client.on(eventName, event.execute.bind(null, this.client));
            });
            logMessage('Registered to receive events:', events.map(e => path.basename(e, '.js')).join(', '));
        }
        catch(err) {
            return logMessage('Error reading events directory during startup.', err, true);
        }
    }

    private async setInteractions(): Promise<void> {
        if (!this.client.updateInteractions) this.client.updateInteractions = this.setInteractions;
        logMessage('Setting interaction commands');
        if (!this.client.interactions) this.client.interactions = new Collection();
        if (!this.client.application?.owner) await this.client.application?.fetch();
        
        const interactionFiles: string[] = fs.readdirSync(path.join(__dirname, 'interactions'))
            .filter(i => i.toLowerCase().endsWith('.js'));6

        let globalCommandsToSet : ApplicationCommandData[] = []; //Collect all global commands
        let guildCommandsToSet : {[guild: string] : ApplicationCommandData[]} = {}; // Collect all guild-specific commands. 
        let allInteractions : DiscordInteraction[] = [];

        // TODO! - Get the commands list per-server from the database 

        for (const file of interactionFiles) {
            const interaction: DiscordInteraction = require(path.join(__dirname, 'interactions', file)).discordInteraction;
            if (!interaction) continue;
            // Add all valid interactions to the main array.
            allInteractions.push(interaction);
            // Global commands should be added to the global list.
            if (interaction.public === true) globalCommandsToSet.push(interaction.command.toJSON());
            // If we can get this working, change it to a database of servers and unlisted interactions that are allowed.
            if (!!interaction.guilds && interaction.public === false) {
                for (const guild in interaction.guilds) {
                    if (!guildCommandsToSet[interaction.guilds[guild]]) guildCommandsToSet[interaction.guilds[guild]] = [];
                    guildCommandsToSet[interaction.guilds[guild]].push(interaction.command.toJSON());
                }
            }
            this.client.interactions?.set(interaction.command.name, interaction);
        }

        // Now we have the commands organised, time to set them up. 
        logMessage('Setting up interactions', { count: allInteractions.length });

        // Set global commands
        try {
            if (globalCommandsToSet.length) {
                // Remove all global commands
                await this.rest.put(
                    Routes.applicationCommands(this.clientId),
                    { body: [] }
                );
                // Add all valid commands. 
                await this.rest.put(
                    Routes.applicationCommands(this.clientId),
                    { body: globalCommandsToSet }
                );
                logMessage('Global interactions set up', { commands: globalCommandsToSet.map(c => c.name).join(', ') });
            }
            else logMessage('No global interactions to set', {}, true);
        }
        catch(err) {
            logMessage('Error setting global interactions', {err, commands: globalCommandsToSet.map(c => c.name)}, true);
            await this.client.application?.commands.set(globalCommandsToSet).catch(() => logMessage('Failed fallback command setter.'));
        }

        // Set guild commands
        for (const guildId of Object.keys(guildCommandsToSet)) {
            const guild = await this.client.guilds.fetch(guildId).catch(() => undefined)

            try {
                // Remove all current commands
                await this.rest.put(
                    Routes.applicationGuildCommands(this.clientId, guildId),
                    { body: [] }
                );
                // Add all valid commands.
                await this.rest.put(
                    Routes.applicationGuildCommands(this.clientId, guildId),
                    { body: guildCommandsToSet[guildId] }
                );
                logMessage('Guild interactions set up', { guild: guild?.name || guildId, commands: guildCommandsToSet[guildId].map(c => c.name).join(', ') });
            }
            catch(err) {
                logMessage('Error setting guild interactions', { guild: guild?.name || guildId, err, commands: guildCommandsToSet[guildId].map(c => c.name) }, true);
            }
        }

        
    }
}