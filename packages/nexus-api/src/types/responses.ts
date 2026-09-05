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

type StatusPageComponentStatus = 'operational' | 'partial_outage' | string;
type StatusPageIncidentStatus = 'identified' | 'investigating' | 'scheduled' | 'in_progress' | string;
type StatusPageImpact = 'major' | 'critical' | 'minor' | 'none' | string;
type StatusPageIndicator = 'minor' | string;

interface IStatusPageQuickResponse {
    page: {
        id: string;
        name: string;
        url: string;
        time_zone: string;
        updated_at: string;
    }
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

interface IStatusPageComponent {
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

interface IStatusPageIncident {
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
}

interface IStatusPageIncidentUpdate {
    id: string;
    status: StatusPageIncidentStatus;
    body: string;
    incident_id: string;
    created_at: string;
    updated_at: string;
    display_at: string;    
    affected_components: {
        code: string;
        name: string;
        old_status: string;
        new_status: string;
    }[]
}
