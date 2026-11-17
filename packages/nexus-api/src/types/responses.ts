/**
 * Response shapes for the two Nexus Mods endpoints that are not GraphQL.
 *
 * Lifted out of apps/bot/src/types/util.ts, which is a grab-bag of caches, emoji ids and
 * enums that happened to also hold these. They describe what the API returns, so they
 * belong beside the code that calls it - and `other.ts` needed them, which would
 * otherwise have made this package import the application it was cut from.
 *
 * Everything here is hand-written on purpose: the download stats come back as CSV and the
 * status page is Atlassian Statuspage, so neither is in schema.graphql and neither can be
 * generated. The string unions are deliberately widened with `| string` - a status the
 * API adds should not stop the bot compiling.
 */
export interface ModDownloadInfo {
    id: number,
    total_downloads: number,
    unique_downloads: number
}

export type StatusPageResponse<T extends boolean> = T extends true ? IStatusPageFullResponse : IStatusPageQuickResponse;

/** Present on every Statuspage response, including the two that carry nothing else. */
export interface IStatusPageInfo {
    id: string;
    name: string;
    url: string;
    time_zone: string;
    updated_at: string;
}

type StatusPageComponentStatus = 'operational' | 'partial_outage' | string;
type StatusPageIncidentStatus = 'identified' | 'investigating' | 'scheduled' | 'in_progress' | string;
type StatusPageImpact = 'major' | 'critical' | 'minor' | 'none' | string;
type StatusPageIndicator = 'minor' | string;

interface IStatusPageQuickResponse {
    page: IStatusPageInfo;
    status: {
        indicator: StatusPageIndicator;
        description: string;
    }
}

export interface IStatusPageFullResponse extends IStatusPageQuickResponse {
    components: IStatusPageComponent[];
    incidents: IStatusPageIncident[];
    scheduled_maintenances: IStatusPageIncident[];
}

export interface IStatusPageComponent {
    id: string;
    name: string;
    status: StatusPageComponentStatus;
    created_at: string;
    updated_at: string;
    position: number;
    description: string;
    showcase: boolean;
    start_date: string;
    group_id: string | null;
    page_id: string;
    group: boolean;
    only_show_if_degraded: boolean;
}

export interface IStatusPageIncident {
    id: string;
    name: string;
    status: StatusPageIncidentStatus;
    created_at: string;
    updated_at: string;
    monitoring_at: string | null;
    resolved_at: string | null;
    impact: StatusPageImpact;
    shortlink: string;   
    started_at: string;
    page_id: string;
    incident_updates: IStatusPageIncidentUpdate[];
    /** The services this incident touches, and the state they are in now. */
    components: IStatusPageComponent[];
    /** How often Statuspage nags the team to post an update. Not useful to a reader. */
    reminder_intervals: string | null;
}

export interface IStatusPageIncidentUpdate {
    id: string;
    status: StatusPageIncidentStatus;
    body: string;
    incident_id: string;
    created_at: string;
    updated_at: string;
    display_at: string;    
    /**
     * Null, not an empty array, when an update names no components - incident
     * 0t68swst8f0k's only update is the live example. Mapping over it without the guard
     * is a crash in the middle of an outage, which is the worst possible time for one.
     */
    affected_components: IStatusPageAffectedComponent[] | null;
    /**
     * Whether whoever posted this update asked Statuspage to tell subscribers.
     *
     * Set per update and often false - four of the five updates on incident g58k87wh2xqq
     * are. A feed that ignores it announces the updates staff deliberately kept quiet.
     */
    deliver_notifications: boolean;
    custom_tweet: string | null;
    tweet_id: string | null;
}

export interface IStatusPageAffectedComponent {
    code: string;
    name: string;
    old_status: string;
    new_status: string;
}

export interface IStatusPageIncidentResponse {
    page: IStatusPageInfo;
    incidents: IStatusPageIncident[];
}

export interface IStatusPageMaintenanceResponse {
    page: IStatusPageInfo;
    scheduled_maintenances: IStatusPageIncident[];
}
