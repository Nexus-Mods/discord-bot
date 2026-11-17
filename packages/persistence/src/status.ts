import { query, withTransaction } from './dbConnect.js';
import type { Logger } from '@nexusmods/core/logger.js';

/**
 * What the status feed has already posted, so a restart does not repost it.
 *
 * Keyed by the Statuspage *update* id rather than a timestamp: updates are edited after
 * publication and `display_at` can be backdated, both of which a watermark would silently
 * skip past. An id either has been posted or has not.
 */

async function postedUpdateIds(logger: Logger): Promise<string[]> {
    try {
        const data = await query<{ update_id: string }>(
            'SELECT update_id FROM status_updates_posted',
            []
        );
        return data.rows.map((r) => r.update_id);
    }
    catch(err) {
        logger.error('Error getting saved status updates', err, true);
        throw err;
    }
}

async function markUpdatesPosted(logger: Logger, updates: { id: string, incident_id: string }[]): Promise<void> {
    if (!updates.length) return;
    try {
        const posted_at = new Date();
        await withTransaction(async (tx) => {
            for (const update of updates) {
                // Without the conflict clause one duplicate aborts the whole transaction,
                // so nothing is recorded and the entire batch posts again next poll.
                await tx(
                    'INSERT INTO status_updates_posted (update_id, incident_id, posted_at) VALUES ($1, $2, $3) '+
                    'ON CONFLICT (update_id) DO NOTHING',
                    [update.id, update.incident_id, posted_at]
                );
            }
        });
    }
    catch(err) {
        logger.error('Error updating status page incidents', err, true);
        throw err;
    }
}

/**
 * Forget the incidents that can no longer come back.
 *
 * Membership, not age: the API returns the fifty most recent incidents whatever their
 * date, so anything still in that payload could be reposted if its ids were dropped.
 * Pass the incident ids from the fetch that just succeeded.
 */
async function pruneOldUpdates(logger: Logger, currentIncidentIds: string[]): Promise<void> {
    // `x <> ALL('{}')` is true for every row, so an empty list would empty the table.
    if (!currentIncidentIds.length) return;
    try {
        await query(
            'DELETE FROM status_updates_posted WHERE incident_id <> ALL($1::text[])',
            [currentIncidentIds]
        )
    }
    catch(err) {
        logger.error('Error pruning saved status updates', err, true);
        throw err;
    }
}

export { postedUpdateIds, markUpdatesPosted, pruneOldUpdates };
