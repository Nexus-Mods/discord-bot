import { APIEmbed, EmbedBuilder, RESTPostAPIWebhookWithTokenJSONBody } from "discord.js";
import { getAutomodRules, getBadFiles } from "../api/automod";
import { ISlackMessage, PublishToDiscord, PublishToSlack } from "../api/moderationWebhooks";
import { IMod, IModFile } from "../api/queries/v2";
import { IModResults } from "../api/queries/v2-latestmods";
import { isTesting, Logger } from "../api/util";
import { ClientExt } from "../types/DiscordTypes";
import { IAutomodRule, IBadFileRule } from "../types/util";
import { tall } from 'tall';
import { DiscordBotUser, DummyNexusModsUser } from "../api/DiscordBotUser";
import axios, { AxiosResponse } from "axios";

interface IModWithFlags {
    mod: Partial<IMod>
    flags: {
        low: (AutoModFlags | string)[];
        high: (AutoModFlags | string)[];
    }
}

enum AutoModFlags {
    FirstUpload = 'First mod upload',
    FirstUploadProbablySpam = 'First upload, short description. Probable spam.',
    NewAccount = 'New account',

}

export class AutoModManager {
    private static instance: AutoModManager;

    private AutoModRules: IAutomodRule[] = [];
    private BadFiles: IBadFileRule[] = [];
    private client: ClientExt;
    private logger: Logger;
    private updateTimer?: NodeJS.Timeout;
    private pollTime: number;
    private lastCheck: Date = new Date(new Date().valueOf() - (60000 * 10))
    public lastReports: IModWithFlags[][] = []; // A rolling list of the last 10 reports
    public recentUids: Set<string> = new Set<string>(); // A list of recently checked Uids

    private addToLastReports(mods: IModWithFlags[]) {
        this.lastReports = [mods, ...this.lastReports.filter((v, i) => i <= 9)];
        this.recentUids = this.lastReports.reduce((prev, cur) => {
            const uids: string[] = cur.map(c => c.mod.uid!);
            prev = new Set<string>([...prev, ...uids]);
            return prev;
        }, new Set<string>());
    }

    static async getInstance(client: ClientExt, logger: Logger, pollTime?: number): Promise<AutoModManager> {
        if (!AutoModManager.instance) {
            try {
                const rules = await getAutomodRules();
                const badFiles = await getBadFiles();
                AutoModManager.instance = new AutoModManager(client, logger, rules, badFiles, pollTime);

            }
            catch(err){
                logger.error('Error getting AutoModManager instance', err);
                throw err;
            }
        }

        return AutoModManager.instance;
        
    }

    private constructor(client: ClientExt, logger: Logger, rules?: IAutomodRule[], badFiles?: IBadFileRule[], pollTime: number = (1000*60*1)) {
        // Save the client for later
        this.client = client;
        this.logger = logger;
        this.pollTime = pollTime;
        // Set initial rules and files
        this.AutoModRules = rules || [];
        this.BadFiles = badFiles || [];
        // Set the update interval. Unless testing
        if (isTesting) {
            logger.debug('Skipping automod setup due to testing env')
            return;
        };
        if (this.client.shard && this.client.shard.ids[0] !== 0) {
            logger.debug('Skipping automod setup due to sharding')
            return;
        }
        this.updateTimer = setInterval(this.runAutomod.bind(this), pollTime);
        logger.info(`Automod started with ${this.AutoModRules.length} rules, checking every ${this.pollTime/1000/60} minutes. Last check ${this.lastCheck}`);
        // this.runAutomod().catch((err) => logger.error(`Error running automod`, err));
    }

    public async retrieveRules(): Promise<IAutomodRule[]> {
        return this.AutoModRules;
    }

    public async retrieveFileRules(): Promise<IBadFileRule[]> {
        return this.BadFiles;
    }

    public clearRuleCache(): void {
        this.getRules();
    }

    private async getRules() {
        try {
            this.AutoModRules = await getAutomodRules();
            this.BadFiles = await getBadFiles();
        }
        catch(err) {
            this.logger.warn("Error getting automod rules", err)
            throw new Error('Could not get Automod rules: '+(err as Error).message)
        }
    }

    private setLastCheck(newDate: Date | string) {
        // logMessage('Setting Last Check', { old: this.lastCheck, new: newDate });
        this.lastCheck = typeof newDate === 'string' ? new Date(newDate) : newDate;
    }

    private async runAutomod() {
        try {
            const dummyUser = new DiscordBotUser(DummyNexusModsUser, this.logger);
            if (!dummyUser) throw new Error("User not found for automod");
            await this.getRules();
            const newMods: IModResults = await dummyUser?.NexusMods.API.v2.LatestMods(this.lastCheck)
            const updatedMods: IModResults = await dummyUser?.NexusMods.API.v2.UpdatedMods(this.lastCheck, true);
            const modsToCheck = [...newMods.nodes, ...updatedMods.nodes].filter(mod => !this.recentUids.has(mod.uid!));
            if (!modsToCheck.length) {
                this.logger.info("Automod - Nothing for automod to check")
                this.setLastCheck(new Date())
                this.addToLastReports([]);
                return;
            }
            else this.logger.info(`Automod - Checking ${modsToCheck.length} new and updated mods.`)
            this.setLastCheck(newMods.nodes[0]?.createdAt ?? updatedMods.nodes[0].updatedAt!)

            let results: IModWithFlags[] = []
            for (const mod of modsToCheck) {
                results.push(await analyseMod(mod, this.AutoModRules, this.BadFiles, dummyUser, this.logger))
            }
            this.addToLastReports(results);
            // Map the concerns for posting
            const concerns = results.filter(m => (m.flags.high.length) > 0 || (m.flags.low.length) > 0);
            if (!concerns.length) {
                this.logger.info('No mods with concerns found.')
                return;
            }
            else {
                try {
                    this.logger.info('Reporting mods:', concerns.map(c => `${c.mod.name} - ${c.flags.high.join(', ')} - ${c.flags.low.join(', ')}`));
                    await PublishToSlack(flagsToSlackMessage(concerns), this.logger);
                    await PublishToDiscord(flagsToDiscordEmbeds(concerns), this.logger);
                }
                catch(err) {
                    this.logger.error('Error posting automod to Discord or Slack', err)
                }
            }
        }
        catch(err) {
            this.logger.error("Error running automod", err)
        }
    }
}


function flagsToSlackMessage(data: IModWithFlags[]): ISlackMessage {
    const modBlocks = data.map(input => {
        const userId = input.mod.uploader?.memberId
        const modLink = `https://nexusmods.com/${input.mod.game?.domainName}/mods/${input.mod.modId}`;
        const userLink = `https://nexusmods.com/users/${input.mod.uploader?.memberId}`;
        const uploadTime = Math.floor(new Date(input.mod.createdAt?.toString() || 0).getTime()/ 1000);
        const joinTime = Math.floor(new Date(input.mod.uploader?.joined?.toString() || 0).getTime()/ 1000);

        return {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `<${modLink}|${input.mod.name}> uploaded by <${userLink}|${input.mod.uploader?.name}>\n`+
                `<!date^${uploadTime}^Posted {time_secs} {date_short_pretty}|${input.mod.createdAt}>\n\n`+
                `<!date^${joinTime}^User Joined {time_secs} {date_short_pretty}|${input.mod.uploader?.joined}>\n\n`+
                `*Game:* ${input.mod.game?.name ?? 'Unknown Game'}\n\n`+
                `*Flags:*\n${[...input.flags.high.map(f => `- ${f} [HIGH]`), ...input.flags.low.map(f => `- ${f} [LOW]`)].join('\n')}\n`+
                `<https://www.nexusmods.com/admin/members/ban?ban_action=1&user_id=${userId}|Ban>  |  <https://www.nexusmods.com/admin/members/ipuse?uid=${userId}|IP History>`
            },
            accessory: {
                type: 'image',
                image_url: input.mod.pictureUrl,
                alt_text: input.mod.name
            }
        }
    })

    // Are there any concerns that require a ping?
    const pingable: boolean = data.filter(m => (m.flags.high.length) > 0).length > 0;
    if (!pingable) return { blocks: [] };

    return { 
        blocks: [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: pingable ? 'Mod spam detected' : 'Automod report'
                }
            },
            {
                type: 'divider'
            },
            ...modBlocks as any,
            {
                type: 'divider'
            },
            pingable ? {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: 'FAO <!subteam^SC2Q2J1DF>'
                }
            } : { type: 'divider' }
        ]
    }
}

function flagsToDiscordEmbeds(data: IModWithFlags[]): RESTPostAPIWebhookWithTokenJSONBody {
    const modEmbeds = (input: IModWithFlags): APIEmbed => {
        const userId = input.mod.uploader?.memberId
        const modLink = `https://nexusmods.com/${input.mod.game?.domainName}/mods/${input.mod.modId}`;
        const userLink = `https://nexusmods.com/users/${input.mod.uploader?.memberId}`;
        const joinTime = Math.floor(new Date(input.mod.uploader?.joined?.toString() || 0).getTime()/ 1000);

        const embed = new EmbedBuilder()
        .setTitle(input.mod.name ?? '???')
        .setURL(modLink)
        .setTimestamp(new Date(input.mod.createdAt!))
        .setThumbnail(input.mod.pictureUrl ?? null)
        .setColor(input.flags.high.length > 0 ? 'DarkRed' : 'Yellow')
        .setFields([
            {
                name: "Flags",
                value: `\`\`\`${[...input.flags.high.map(f => `- ${f} [HIGH]`), ...input.flags.low.map(f => `- ${f} [LOW]`)].join('\n')}\`\`\``
            },
            {
                name: "Uploader",
                value: `[${input.mod.uploader?.name}](${userLink}) - Joined <t:${joinTime}:R>\n`+
                `[Ban](https://www.nexusmods.com/admin/members/ban?ban_action=1&user_id=${userId}) | [IP History](https://www.nexusmods.com/admin/members/ipuse?uid=${userId})`,
                inline: true
            }
        ])
        .setFooter({ text: input.mod.game?.name ?? 'Unknown Game' })

        return embed.toJSON()
    }

    // Are there any concerns that require a ping?
    const pingable: boolean = data.filter(m => (m.flags.high.length) > 0).length > 0;

    // Sort any high priority pings to the bottom
    const ordered: IModWithFlags[] = data.sort((a, b) => a.flags.high.length > b.flags.high.length ? -1 : 1);
    
    return {
        content: pingable ? "# Mod Spam Detected\n@here" : "# Automod Detections", //role pings <@&1308814010602487839> <@&520360132631199744>
        username: "Automod",
        embeds: ordered.map(modEmbeds)
    }
}

async function analyseMod(mod: Partial<IMod>, rules: IAutomodRule[], badFiles: IBadFileRule[], user: DiscordBotUser, logger: Logger): Promise<IModWithFlags> {
    let flags: {high: string[], low: string[]} = { high: [], low: [] };    
    const now = new Date()
    const anHourAgo = new Date(now.valueOf() - (60000 * 60)).getTime()
    const userJoined = new Date(mod.uploader!.joined).getTime();
    // const modCreatedAt = new Date(mod.createdAt!).getTime();

    if (userJoined >= anHourAgo) flags.low.push(AutoModFlags.NewAccount);
    
    if (mod.uploader!.modCount <= 1) {
        if ((mod.description ?? '').length < 150 && flags.low.includes(AutoModFlags.NewAccount)) {
            flags.high.push(AutoModFlags.FirstUploadProbablySpam)
        }
        // else if (modCreatedAt >= anHourAgo) flags.low.push(AutoModFlags.FirstUpload)
    };


    try {
        const previewCheck = await checkFilePreview(mod, user, badFiles, logger)
        if (previewCheck.flags.high.length) flags.high.push(...previewCheck.flags.high)
        if (previewCheck.flags.low.length) flags.low.push(...previewCheck.flags.low)
    }
    catch(err) {
        if ((err as any).code === 401) logger.warn(`Permissions error getting content preview for ${mod.name} for ${mod.game?.name}`)
        else logger.warn(`Failed to check content preview for ${mod.name} for ${mod.game?.name}`, err);
    }


    // Check against automod rules
    let allText = `${mod.name}\n${mod.summary}\n${mod.description}`.toLowerCase();
    const urls = await analyseURLS(allText, logger);
    if (urls.length) {
        urls.map(u => flags.low.push(`Shortened URL - ${u}`));
        allText = `${allText}\n\n${urls.map(u => u.toLowerCase()).join('\n')}`;
    }
    rules.forEach(rule => {
        if (allText.includes(rule.filter.toLowerCase())) {
            flags[rule.type].push(rule.reason)
        }
    });

    // return mod with flags
    return { mod, flags };
}

async function analyseURLS(text: string, logger: Logger): Promise<string[]> {
    const regEx = new RegExp(/\b(https?:\/\/.*?\.[a-z]{2,4}\/[^\s\[\]]*\b)/g);
    const matches = text.match(regEx);
    if (!matches) return [];
    // logMessage("URLs in mod description", matches.toString());
    const matchUrls: Set<string> = new Set(matches.filter(filterUrls));
    if (!matchUrls.size) return [];
    // logMessage("URLs to check in mod description", matchUrls);
    const result: string[] = []
    for (const url of matchUrls.values()) {
        try {
            const finalUrl = await tall(url, { timeout: 5 });
            if (finalUrl) {
                if (finalUrl !== url) {
                    logger.info("Expanded URL", { url, finalUrl })
                    result.push(`${url} => ${finalUrl}`)
                }
            }
            // else logMessage('Could not expand url', url)

        }
        catch(err) {
            if ((err as Error).message.includes('socket hang up')) continue;
            logger.warn("Error expanding URL", { err, url });
        }
    }
    return result;
}

function filterUrls(uri: string): boolean {
    if (uri.toLowerCase().includes('nexusmods.com')) return false;
    const ext = uri.split('.').pop()?.toLowerCase()

    const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", 
    "tiff", "tif", "webp", "svg", "ico", "heic"];

    if (!ext || imageExts.includes(ext)) return false

    return true;
}

interface IPreviewDirectory {
    name: string;
    path: string;
    type: 'directory';
    children: (IPreviewDirectory | IPreviewFile)[];
}

interface IPreviewFile {
    name: string;
    path: string;
    type: 'file';
    size: string;
}

const nonPlayableExtensions: string[] = [
    "jpg", "jpeg", "png", "gif", "bmp", 
    "tiff", "tif", "webp", "svg", "heic", 
    "txt", "csv", "log", "md", "html", "htm", 
    "rtf", "tex", "docx", "odt", "pdf", "url"
];

async function checkFilePreview(mod: Partial<IMod>, user: DiscordBotUser, badFiles: IBadFileRule[], logger: Logger): Promise<IModWithFlags> {
    const flags: { high: string[], low: string[] } = { high: [], low: [] };
    const modFiles = await user.NexusMods.API.v2.ModFiles(mod.game!.id, mod.modId!);
    if (!modFiles || !modFiles.length) throw new Error('No files found for mod');
    const latestFile = modFiles.sort((a, b) => a.date - b.date)[0];
    const previewUrl = getContentPreviewLink(mod.game!.id, mod.modId!, latestFile).toString();
    logger.info(`Checking file preview for ${latestFile.name} on ${mod.name} for ${mod.game?.name}`);

    // Check the content preview
    try {
        const request: AxiosResponse<IPreviewDirectory, any> = await axios({
            url: previewUrl,
            transformResponse: (res) => JSON.parse(res),
            validateStatus: () => true,
        });
        // No content preview (there's always a link, but it's not always valid!)
        // if (request.status === 404) flags.low.push('No content preview for latest file.')
        if (request.status === 200) {
            const allFiles: string[] = flattenDirectory(request.data);

            // Check known bad files
            const fileFlags = checkKnownBadFiles(allFiles, badFiles);
            if (fileFlags.high) flags.high.push(...fileFlags.high)
            if (fileFlags.low) flags.low.push(...fileFlags.low)

            // Check if it's exclusively non-playable files
            const playableFiles = allFiles.filter(file => {
                const extension: string | undefined = file.split('.').pop()?.toLowerCase();
                if (extension === file || !extension) return false;
                if (nonPlayableExtensions.includes(extension)) return false;
                return true;
            });

            if (playableFiles.length === 0) {
                flags.low.push("Does not contain any playable files. Likely spam.");
            }
            
        }
        else if (![404, 200].includes(request.status)) flags.low.push(`Failed to get content preview. HTTP ERROR ${request.status}`);

    }
    catch(err) {
        logger.warn('Could not process file preview', err);
    }

    
    return { mod, flags };
}

function getContentPreviewLink(gameId: number, modId: number, file: IModFile): URL {
    // e.g. https://file-metadata.nexusmods.com/file/nexus-files-s3-meta/2295/1221/Share%20Modlist%20Information-1221-1-0-1-1741637795.7z.json    
    return new URL(`https://file-metadata.nexusmods.com/file/nexus-files-s3-meta/${gameId}/${modId}/${encodeURI(file.uri)}.json`);
}

function flattenDirectory(input: IPreviewDirectory): string[] {
    const files = input.children.filter(c => c.type === 'file').map(c => c.name);
    const subFolders = input.children.filter(c => c.type === 'directory');
    for (const subFolder of subFolders) {
        files.push(...flattenDirectory(subFolder));
    }
    return files;
}

function checkKnownBadFiles(flattenedFiles: string[], badFiles: IBadFileRule[]): { low: string[], high: string[] } {
    const flags = { low: new Array<string>(), high: new Array<string>() };

    for (const badFileRule of badFiles) {
        let result = null;
        if (badFileRule.funcName === 'match') result = flattenedFiles.find(f => f.toLowerCase().match(badFileRule.test) !== null);
        else result = flattenedFiles.find(f => f.toLowerCase()[badFileRule.funcName](badFileRule.test))
        // If we found something!
        if (result) flags[badFileRule.type].push(`${badFileRule.flagMessage} -- Rule: ${badFileRule.test}, Func: ${badFileRule.funcName}`);
    }

    return flags;
}