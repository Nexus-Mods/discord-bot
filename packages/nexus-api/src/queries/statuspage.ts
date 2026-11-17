import type { Logger } from '@nexusmods/core/logger.js';
import { NexusApiError } from '@nexusmods/core/errors.js';
import type {
    StatusPageResponse,
    IStatusPageIncidentResponse,
    IStatusPageMaintenanceResponse,
} from '../types/responses.js';

/**
 * The Atlassian Statuspage endpoints, which are not Nexus Mods' API at all.
 *
 * Split out of other.ts because that file is "the Nexus Mods endpoints that are not
 * GraphQL" and this is a third party with its own base URL, its own shapes and its own
 * reasons to change. Four endpoints with one request shape between them.
 *
 * WHICH ENDPOINT MATTERS MORE THAN IT LOOKS. `summary.json` carries only *unresolved*
 * incidents, so anything watching it sees an incident appear and then vanish when it is
 * resolved, never seeing the resolution. `incidents.json` returns the fifty most recent
 * including resolved and postmortem ones, which is what a feed needs.
 */

const STATUS_URL = 'https://nexusmods.statuspage.io/api/v2/status.json';
const SUMMARY_URL = 'https://nexusmods.statuspage.io/api/v2/summary.json';
const INCIDENTS_URL = 'https://nexusmods.statuspage.io/api/v2/incidents.json';
const MAINTENANCES_URL = 'https://nexusmods.statuspage.io/api/v2/scheduled-maintenances.json';

/**
 * One request, one failure story.
 *
 * `what` only ever reaches the log and the error, so it reads as a noun phrase: "Could not
 * fetch the website status incidents".
 */
async function fetchStatusPage<T>(
    url: string,
    what: string,
    headers: Record<string, string>,
    logger: Logger,
): Promise<T> {
    try {
        const res = await fetch(url, {
            headers: {
                'Application-Name': headers['Application-Name'],
                'Application-Version': headers['Application-Version'],
            },
        });
        if (!res.ok) throw new Error(`${res.status} - ${res.statusText}`);
        return await res.json() as T;
    }
    catch (err) {
        logger.error(`Error getting website ${what} from statuspage.io`, err, true);
        throw new NexusApiError(`Could not fetch the website ${what}`, {
            cause: err instanceof Error ? err : new Error(String(err)),
            userMessage: 'statuspage.io could not be reached. Please try again shortly.',
        });
    }
}

/** The overall indicator, or the full summary - which lists only unresolved incidents. */
export async function WebsiteStatus<B extends boolean>(
    headers: Record<string, string>,
    logger: Logger,
    full: B,
): Promise<StatusPageResponse<B>> {
    return fetchStatusPage<StatusPageResponse<B>>(full ? SUMMARY_URL : STATUS_URL, 'status', headers, logger);
}

/** The fifty most recent incidents, resolved ones included. */
export async function WebsiteStatusIncidents(
    headers: Record<string, string>,
    logger: Logger,
): Promise<IStatusPageIncidentResponse> {
    return fetchStatusPage<IStatusPageIncidentResponse>(INCIDENTS_URL, 'status incidents', headers, logger);
}

/** The fifty most recent scheduled maintenances, completed ones included. */
export async function WebsiteStatusMaintenances(
    headers: Record<string, string>,
    logger: Logger,
): Promise<IStatusPageMaintenanceResponse> {
    return fetchStatusPage<IStatusPageMaintenanceResponse>(MAINTENANCES_URL, 'scheduled maintenances', headers, logger);
}
