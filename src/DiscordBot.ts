import { REST, Client, Collection, GatewayIntentBits, Routes, Snowflake, IntentsBitField, RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import * as fs from 'fs';
import path from 'path';
import { logMessage } from './api/util';
import { DiscordEventInterface, DiscordInteraction, ClientExt } from './types/DiscordTypes';
import { GameListCache } from './types/util';
import config from '../config.json' assert { type: 'json' };
import { fileURLToPath, pathToFileURL } from 'url';

// Get the equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const intents: GatewayIntentBits[] = [
    IntentsBitField.Flags.Guilds, IntentsBitField.Flags.DirectMessages,
    IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.GuildWebhooks,
    IntentsBitField.Flags.GuildMessageReactions, IntentsBitField.Flags.GuildIntegrations
];

export class DiscordBot {
    private static instance: DiscordBot;

    private token: Snowflake = process.env.DISCORD_TOKEN as Snowflake;
    private clientId: Snowflake = process.env.DISCORD_CLIENT_ID as Snowflake;
    public client: ClientExt = new Client({ intents });
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
        
        this.client.config = config;
        this.client.application?.fetch();
        this.setEventHandler();
    }

    public async connect(): Promise<void> {
        logMessage('Attempting to log in.')
        try {
            await this.client.login(this.token);
            logMessage('Connected to Discord');
            await this.client.application?.fetch();
            this.client.updateInteractions = this.setupInteractions.bind(this)
        }
        catch(err) {
            logMessage('Failed to connect to Discord during bot setup', { error: (err as Error).message }, true);
            return process.exit();
        }

        try {
            this.client.gamesList = await new GameListCache().init();
        }
        catch(err) {
            logMessage('Could not pre-cache the games list', err, true);
        }
    }

    public async setupInteractions(force?: boolean): Promise<void> {
        try {
            await this.setInteractions(force);
        }
        catch(err) {
            logMessage('Failed to set interactions', err, true);
            if (force === true) return Promise.reject(err);
        }
    }

    private setEventHandler(): void {
        try {
            const events: string[] = fs.readdirSync(path.join(__dirname, 'events'));
            events.filter(e => e.endsWith('.js')).forEach(async (file) => {
                try {
                    // Convert the path to a file:// URL
                    const eventPath = pathToFileURL(path.join(__dirname, 'events', file)).href;
                    const event: DiscordEventInterface = (await import(eventPath)).default;
                    const eventName: string = file.split(".")[0];
                    if (!event.execute) return;
                    if (event.once) this.client.once(eventName, event.execute.bind(null, this.client));
                    else this.client.on(eventName, event.execute.bind(null, this.client));
                }
                catch(err) {
                    logMessage('Failed to register event '+file, err);
                }
            });
            logMessage('Registered to receive events:', events.map(e => path.basename(e, '.js')).join(', '));
        }
        catch(err) {
            return logMessage('Error reading events directory during startup.', err, true);
        }
    }

    private async setInteractions(forceUpdate?: boolean): Promise<void> {
        if (!this.client.updateInteractions) this.client.updateInteractions = this.setInteractions;
        logMessage('Setting interaction commands');
        if (!this.client.interactions) this.client.interactions = new Collection();
        if (!this.client.application?.owner) await this.client.application?.fetch();
        
        const interactionFiles: string[] = fs.readdirSync(path.join(__dirname, 'interactions'))
            .filter(i => i.toLowerCase().endsWith('.js'));6

        let globalCommandsToSet : RESTPostAPIApplicationCommandsJSONBody[] = []; //Collect all global commands
        const commandsReg = await this.client.application?.commands.fetch(); // Collection of global commands that are already registered.
        let guildCommandsToSet : {[guild: string] : RESTPostAPIApplicationCommandsJSONBody[]} = {}; // Collect all guild-specific commands. 
        let allInteractions : DiscordInteraction[] = [];

        // TODO! - Get the commands list per-server from the database 

        for (const file of interactionFiles) {
            // Convert the path to a file:// URL
            const interactionPath = pathToFileURL(path.join(__dirname, 'interactions', file)).href;
            const interaction: DiscordInteraction = (await import(interactionPath)).discordInteraction;
            if (!interaction) continue;
            // Add all valid interactions to the main array.
            allInteractions.push(interaction);
            // Global commands should be added to the global list if not already registered.
            if (interaction.public === true) globalCommandsToSet.push(interaction.command.toJSON());
            // If we can get this working, change it to a database of servers and unlisted interactions that are allowed.
            if (!!interaction.guilds && interaction.public === false) {
                for (const guild in interaction.guilds) {
                    if (!guildCommandsToSet[interaction.guilds[guild]]) guildCommandsToSet[interaction.guilds[guild]] = [];
                    guildCommandsToSet[interaction.guilds[guild]].push(interaction.command.toJSON());
                }
            }
            this.client.interactions?.set(interaction.command.name, interaction);
            // Set up aliases
            if (interaction.aliases?.length) {
                for (const alias of interaction.aliases) {
                    logMessage('Adding alias', { alias, name: interaction.command.name });
                    this.client.interactions?.set(alias, interaction);
                }
            }
        }

        // Now we have the commands organised, time to set them up. 
        logMessage('Setting up interactions', { count: allInteractions.length });

        // Set global commands
        try {
            if (globalCommandsToSet.length) {
                const newCommands = globalCommandsToSet.filter(g => !commandsReg?.find(c => c.name === g.name));
                if (newCommands.length || forceUpdate) {
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
                else logMessage('Global interactions did not require changes');
            }
            else logMessage('No global interactions to set', {}, true);
        }
        catch(err) {
            logMessage('Error setting global interactions', {err, commands: globalCommandsToSet.map(c => c.name)}, true);
            await this.client.application?.commands.set(globalCommandsToSet).catch(() => logMessage('Failed fallback command setter.'));
        }

        // Set guild commands
        for (const guildId of Object.keys(guildCommandsToSet)) {
            const guild = await this.client.guilds.fetch(guildId).catch(() => undefined);
            if (!guild) continue;
            const commands = await guild?.commands.fetch(); // Get commands already set for this guild.
            const newCommands = guildCommandsToSet[guildId].filter(c => !commands?.find(ex => ex.name === c.name));
            if (!newCommands.length && !forceUpdate) continue;


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