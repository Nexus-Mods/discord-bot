import { APIEmbed, EmbedBuilder, RESTPostAPIWebhookWithTokenJSONBody } from "discord.js";
import { getAutomodRules } from "../api/automod";
import { ISlackMessage, PublishToDiscord, PublishToSlack } from "../api/moderationWebhooks";
import { IMod } from "../api/queries/v2";
import { IModResults } from "../api/queries/v2-latestmods";
import { getUserByNexusModsId } from "../api/users";
import { logMessage } from "../api/util";
import { ClientExt } from "../types/DiscordTypes";
import { IAutomodRule } from "../types/util";

const pollTime: number = (1000*60*2); //2 mins

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
    private client: ClientExt;
    private updateTimer: NodeJS.Timeout;
    private lastCheck: Date = new Date(new Date().valueOf() - (60000 * 5))
    public lastReport: IModWithFlags[] = [];

    static getInstance(client: ClientExt): AutoModManager {
        if (!AutoModManager.instance) {
            AutoModManager.instance = new AutoModManager(client);
        }

        return AutoModManager.instance;
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
            .catch((err) => logMessage('Error in AutomodManager contructor', err, true));
    }

    private async getRules() {
        try {
            this.AutoModRules = await getAutomodRules()
        }
        catch(err) {
            logMessage("Error getting automod rules", err, true)
        }
    }

    private setLastCheck(newDate: Date | string) {
        // logMessage('Setting Last Check', { old: this.lastCheck, new: newDate });
        this.lastCheck = typeof newDate === 'string' ? new Date(newDate) : newDate;
    }

    private async runAutomod() {
        try {
            const user = await getUserByNexusModsId(31179975);
            if (!user) throw new Error("User not found for automod");
            await this.getRules();
            const newMods: IModResults = await user?.NexusMods.API.v2.LatestMods(this.lastCheck)
            if (!newMods.nodes.length) {
                logMessage("Automod - Nothing for automod to check")
                this.setLastCheck(new Date())
                this.lastReport = [];
                return;
            }
            else logMessage(`Automod - Checking ${newMods.nodes.length} new mods.`)
            this.setLastCheck(newMods.nodes[0].createdAt!)

            let results: IModWithFlags[] = []
            for (const mod of newMods.nodes) {
                results.push(await analyseMod(mod, this.AutoModRules))
            }
            this.lastReport = results;
            const concerns = results.filter(m => (m.flags.high.length) !== 0);
            if (!concerns.length) {
                logMessage('No mods with concerns found.')
                return;
            }
            else {
                try {
                    logMessage('Reporting mods:', concerns.map(c => `${c.mod.name} - ${c.flags.high.join(', ')} - ${c.flags.low.join(', ')}`));
                    await PublishToSlack(flagsToSlackMessage(concerns));
                    await PublishToDiscord(flagsToDiscordEmbeds(concerns))
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


}


function flagsToSlackMessage(data: IModWithFlags[]): ISlackMessage {
    const modBlocks = data.map(input => {
        const userId = input.mod.uploader?.memberId
        const modLink = `https://nexusmods.com/${input.mod.game?.domainName}/mods/${input.mod.modId}`;
        const userLink = `https://nexusmods.com/users/${input.mod.uploader?.memberId}`;
        const uploadTime = Math.floor(new Date(input.mod.createdAt?.toString() || 0).getTime()/ 1000);

        return {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `<${modLink}|${input.mod.name}> uploaded by <${userLink}|${input.mod.uploader?.name}>\n`+
                `<!date^${uploadTime}^Posted {time_secs} {date_short_pretty}|${input.mod.createdAt}>\n\n`+
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

    return { 
        blocks: [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: 'Mod spam detected'
                }
            },
            {
                type: 'divider'
            },
            ...modBlocks as any,
            {
                type: 'divider'
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: 'FAO <!subteam^SC2Q2J1DF>'
                }
            }
        ]
    }
}

function flagsToDiscordEmbeds(data: IModWithFlags[]): RESTPostAPIWebhookWithTokenJSONBody {
    const modEmbeds = (input: IModWithFlags): APIEmbed => {
        const userId = input.mod.uploader?.memberId
        const modLink = `https://nexusmods.com/${input.mod.game?.domainName}/mods/${input.mod.modId}`;
        const userLink = `https://nexusmods.com/users/${input.mod.uploader?.memberId}`;
        const uploadTime = Math.floor(new Date(input.mod.createdAt?.toString() || 0).getTime()/ 1000);

        const embed = new EmbedBuilder()
        .setTitle(input.mod.name ?? '???')
        .setURL(modLink)
        .setTimestamp(new Date(input.mod.createdAt!))
        .setThumbnail(input.mod.pictureUrl ?? null)
        .setColor(input.flags.high.length > 0 ? 'DarkRed' : 'DarkOrange')
        .setFields([
            {
                name: "Flags",
                value: `\`\`\`${[...input.flags.high.map(f => `- ${f} [HIGH]`), ...input.flags.low.map(f => `- ${f} [LOW]`)].join('\n')}\`\`\``
            },
            {
                name: "Uploader",
                value: `[${input.mod.uploader?.name}](${userLink}) - Joined <t:${uploadTime}:R>\n`+
                `[Ban](https://www.nexusmods.com/admin/members/ban?ban_action=1&user_id=${userId}) | [IP History](https://www.nexusmods.com/admin/members/ipuse?uid=${userId})`,
                inline: true
            }
        ])
        .setFooter({ text: input.mod.game?.name ?? 'Unknown Game' })

        return embed.toJSON()
    }
    
    return {
        content: "# Mod Spam Detected\n@here",
        username: "Automod",
        embeds: data.map(modEmbeds)
    }
}

async function analyseMod(mod: Partial<IMod>, rules: IAutomodRule[]): Promise<IModWithFlags> {
    let flags: {high: string[], low: string[]} = { high: [], low: [] };    
    const now = new Date()
    const anHourAgo = new Date(now.valueOf() - (60000 * 60))

    // Check the user
    if (mod.uploader!.membershipRoles.length > 1) {
        // logMessage("Mod Uploaded by a Supporter or Premium user", {mod: mod.name, user: mod.uploader?.name, created: new Date(mod.createdAt || 0)})
        return { mod, flags };
    }
    else {
        if (new Date(mod.uploader!.joined).getTime() >= anHourAgo.getTime()) {
            logMessage('New uploader', { user: mod.uploader, name: mod.name, anHourAgo, joined: new Date(mod.uploader!.joined) })
            flags.low.push('New account');
        }
    }

    // Check against automod rules
    const allText = `${mod.name}\n${mod.summary}\n${mod.description}`.toLowerCase();
    rules.forEach(rule => {
        if (allText.includes(rule.filter.toLowerCase())) {
            flags[rule.type].push(rule.reason)
        }
    });

    // return mod with flags
    return { mod, flags };
}