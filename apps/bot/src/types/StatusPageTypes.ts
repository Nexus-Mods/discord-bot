import type { IStatusPageIncident, IStatusPageIncidentUpdate } from "@nexusmods/nexus-api/types/responses.js";

export interface StatusUpdateEntry {
    incident: IStatusPageIncident;
    update: IStatusPageIncidentUpdate;
    kind: 'incident' | 'maintenance';
}

export type StatusChange = 'new' | 'update' | 'resolved';

export interface StatusPost {
    incident: IStatusPageIncident;
    /** The newest unseen update - the one the embed shows. */
    latest: IStatusPageIncidentUpdate;
    /** Every unseen update for this incident, so none is left to repost next poll. */
    covered: IStatusPageIncidentUpdate[];
    kind: StatusUpdateEntry['kind'];
    change: StatusChange;
}