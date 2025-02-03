import { APIEmbed, EmbedBuilder, RESTPostAPIWebhookWithTokenJSONBody } from "discord.js";
import { getAutomodRules, getBadFiles } from "../api/automod";
import { ISlackMessage, PublishToDiscord, PublishToSlack } from "../api/moderationWebhooks";
import { IMod } from "../api/queries/v2";
import { IModResults } from "../api/queries/v2-latestmods";
import { getUserByNexusModsId } from "../api/users";
import { logMessage } from "../api/util";
import { ClientExt } from "../types/DiscordTypes";
import { IAutomodRule, IBadFileRule } from "../types/util";
import { tall } from 'tall';
import { DiscordBotUser, DummyNexusModsUser } from "../api/DiscordBotUser";
import axios, { AxiosResponse } from "axios";

const pollTime: number = (1000*60*1); //1 mins

interface IModWithFlags {
    mod: Partial<IMod>
    flags: {
        low: string[];
        high: string[];
    }
}



export class AutoModManager {
    private static instance: AutoModManager;

    private AutoModRules: IAutomodRule[] = [];
    private BadFiles: IBadFileRule[] = [];
    private client: ClientExt;
    private updateTimer: NodeJS.Timeout;
    private lastCheck: Date = new Date(new Date().valueOf() - (60000 * 10))
    public lastReports: IModWithFlags[][] = []; // A rolling list of the last 10 reports
    public recentUids: Set<string> = new Set<string>(); // A list of recently checked Uids

    static getInstance(client: ClientExt): AutoModManager {
        if (!AutoModManager.instance) {
            AutoModManager.instance = new AutoModManager(client);
        }

        return AutoModManager.instance;
    }

    private addToLastReports(mods: IModWithFlags[]) {
        this.lastReports = [mods, ...this.lastReports.filter((v, i) => i <= 9)];
        this.recentUids = this.lastReports.reduce((prev, cur) => {
            const uids: string[] = cur.map(c => c.mod.uid!);
            prev = new Set<string>([...prev, ...uids]);
            return prev;
        }, new Set<string>());
    }

    private constructor(client: ClientExt) {
        // Save the client for later
        this.client = client;
        // Set the update interval.
        this.updateTimer = setInterval(this.runAutomod.bind(this), pollTime);
        this.getRules()
            .then(() => {
                logMessage(`Automod started with ${this.AutoModRules.length} rules, checking every ${pollTime/1000/60} minutes. Last check ${this.lastCheck}`);
                this.runAutomod().catch((err) => logMessage(`Error updating game feeds`, err, true));
            })
            .catch((err) => logMessage('Error in AutomodManager constructor', err, true));
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
            logMessage("Error getting automod rules", err, true)
            throw new Error('Could not get Automod rules: '+(err as Error).message)
        }
    }

    private setLastCheck(newDate: Date | string) {
        // logMessage('Setting Last Check', { old: this.lastCheck, new: newDate });
        this.lastCheck = typeof newDate === 'string' ? new Date(newDate) : newDate;
    }

    private async runAutomod() {
        try {
            const dummyUser = new DiscordBotUser(DummyNexusModsUser);
            if (!dummyUser) throw new Error("User not found for automod");
            await this.getRules();
            const newMods: IModResults = await dummyUser?.NexusMods.API.v2.LatestMods(this.lastCheck)
            const updatedMods: IModResults = await dummyUser?.NexusMods.API.v2.UpdatedMods(this.lastCheck, true);
            const modsToCheck = [...newMods.nodes, ...updatedMods.nodes].filter(mod => !this.recentUids.has(mod.uid!));
            if (!modsToCheck.length) {
                logMessage("Automod - Nothing for automod to check")
                this.setLastCheck(new Date())
                this.addToLastReports([]);
                return;
            }
            else logMessage(`Automod - Checking ${modsToCheck.length} new and updated mods.`)
            this.setLastCheck(newMods.nodes[0]?.createdAt ?? updatedMods.nodes[0].updatedAt!)

            const user = await getUserByNexusModsId(31179975) ?? dummyUser;

            let results: IModWithFlags[] = []
            for (const mod of modsToCheck) {
                results.push(await analyseMod(mod, this.AutoModRules, this.BadFiles, user))
            }
            this.addToLastReports(results);
            // const concerns = results.filter(m => (m.flags.high.length) !== 0);
            const concerns = results.filter(m => (m.flags.high.length) > 0 || (m.flags.low.length) > 0);
            if (!concerns.length) {
                logMessage('No mods with concerns found.')
                return;
            }
            else {
                try {
                    logMessage('Reporting mods:', concerns.map(c => `${c.mod.name} - ${c.flags.high.join(', ')} - ${c.flags.low.join(', ')}`));
                    await PublishToSlack(flagsToSlackMessage(concerns));
                    await PublishToDiscord(flagsToDiscordEmbeds(concerns));
                }
                catch(err) {
                    logMessage('Error posting automod to Discord or Slack', err, true)
                }
            }
        }
        catch(err) {
            logMessage("Error running automod", err, true)
        }
    }

    public async checkSingleMod(gameDomain: string, modId: number) {
        // NOT YET IN USE!
        const user: DiscordBotUser | undefined = await getUserByNexusModsId(31179975);
        if (!user) throw new Error("User not found for automod");
        await this.getRules();
        const modInfo = await user.NexusMods.API.v2.ModsByModId({gameDomain, modId});
        const mod = modInfo[0];
        if (!mod) throw new Error('Mod not found')
        logMessage('Checking specific mod', { name: mod.name, game: mod.game.name });
        const analysis = await analyseMod(mod, this.AutoModRules, this.BadFiles, user);
        if (analysis.flags.high.length) {
            await PublishToDiscord(flagsToDiscordEmbeds([analysis]))
            await PublishToSlack(flagsToSlackMessage([analysis]))
        }
        else logMessage('No flags to report', analysis);
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

async function analyseMod(mod: Partial<IMod>, rules: IAutomodRule[], badFiles: IBadFileRule[], user: DiscordBotUser): Promise<IModWithFlags> {
    let flags: {high: string[], low: string[]} = { high: [], low: [] };    
    const now = new Date()
    const anHourAgo = new Date(now.valueOf() - (60000 * 60))
    
    if (new Date(mod.uploader!.joined).getTime() >= anHourAgo.getTime()) flags.low.push('New account');

    if (mod.uploader!.modCount <= 1 && flags.low.includes('New account')) {
        if ((mod.description ?? '').length < 150) {
            flags.high.push('First upload, short description. Probable spam.')
        }
        flags.low.push('First mod upload')
    };

    // Check the content preview for first mod uploads
    // if (mod.uploader!.modCount <= 1) {
        try {
            const previewCheck = await checkFilePreview(mod, user, badFiles)
            if (previewCheck.flags.high.length) flags.high.push(...previewCheck.flags.high)
            if (previewCheck.flags.low.length) flags.low.push(...previewCheck.flags.low)
        }
        catch(err) {
            logMessage(`Failed to check content preview for ${mod.name} for ${mod.game?.name}`, err, true);
        }
    // }

    // Check against automod rules
    let allText = `${mod.name}\n${mod.summary}\n${mod.description}`.toLowerCase();
    const urls = await analyseURLS(allText);
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

async function analyseURLS(text: string): Promise<string[]> {
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
                    logMessage("Expanded URL", { url, finalUrl })
                    result.push(`${url} => ${finalUrl}`)
                }
            }
            // else logMessage('Could not expand url', url)

        }
        catch(err) {
            logMessage("Error expanding URL", { err, url }, true);
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

async function checkFilePreview(mod: Partial<IMod>, user: DiscordBotUser, badFiles: IBadFileRule[]): Promise<IModWithFlags> {
    const flags: { high: string[], low: string[] } = { high: [], low: [] };
    const modFiles = await user.NexusMods.API.v1.ModFiles(mod.game!.domainName!, mod.modId!);
    const latestFile = modFiles.files.sort((a, b) => a.uploaded_timestamp > b.uploaded_timestamp ? 1 : -1)[0];
    logMessage(`Checking file preview for ${latestFile.name} on ${mod.name} for ${mod.game?.name}`);

    // Check the content preview
    try {
        const request: AxiosResponse<IPreviewDirectory, any> = await axios({
            url: latestFile.content_preview_link,
            transformResponse: (res) => JSON.parse(res),
            validateStatus: () => true,
        });
        // No content preview (there's always a link, but it's not always valid!)
        if (request.status === 404) flags.low.push('No content preview for latest file.')
        else if (request.status !== 200) flags.low.push(`Failed to get content preview. HTTP ERROR ${request.status}`);
        else {
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

    }
    catch(err) {
        logMessage('Could not process file preview', err, true);
    }

    
    return { mod, flags };
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