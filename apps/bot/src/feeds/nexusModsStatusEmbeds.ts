import { EmbedBuilder } from "discord.js";
import type { StatusChange, StatusPost } from "../types/StatusPageTypes.js";
import { NEXUS_ORANGE } from "../lib/embeds.js";

const CHANGE_LABEL: Record<StatusChange, string> = {
    new: 'New incident',
    update: 'Update',
    resolved: 'Resolved',
};

const IMPACT_COLOUR: Record<string, number> = {
    critical: 0xd92b2b,
    major: 0xe8590c,
    minor: 0xf5a524,
    maintenance: 0x3b82f6,
    none: 0x6b7280,
};

const RESOLVED_COLOUR = 0x2f9e44;

export function siteStatusUpdateEmbed(post: StatusPost): EmbedBuilder {
    const { incident, latest, change, kind } = post;
    const label = kind === 'maintenance' && change === 'new' ? 'Scheduled maintenance' : CHANGE_LABEL[change];
    const affected = (latest.affected_components ?? []).map((c) => c.name);

    const embed = new EmbedBuilder()
        .setTitle(`${label}: ${incident.name}`.slice(0, 256))
        .setURL(incident.shortlink)
        .setDescription(latest.body.slice(0, 4000))
        .setColor(change === 'resolved' ? RESOLVED_COLOUR : IMPACT_COLOUR[incident.impact] ?? NEXUS_ORANGE)
        .setTimestamp(new Date(latest.display_at))
        .setFooter({ text: `Nexus Mods status • ${latest.status}` });

    if (affected.length) embed.addFields({ name: 'Affected', value: affected.join(', ') });

    return embed;
}