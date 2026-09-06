import { queryAutoMod } from '@nexusmods/persistence/dbConnect.js';
import type { Logger } from '@nexusmods/core/logger.js';
import type { Rule } from './types';

/**
 * The automod rule CRUD, ported from apps/bot/src/server/AutomodRules.ts.
 *
 * Same queries, same column order, same behaviour. Split out from the request handling so
 * the route can be about HTTP and this can be about rows - the Express version is one
 * function with a switch on `req.method` doing both.
 *
 * Second copy for one step, as with the forum webhook: Express still serves /automod until
 * step 9.
 */

/**
 * LIMIT and OFFSET are interpolated, not parameterised.
 *
 * Carried over as-is because it is not injectable - both are put through `Number()` and
 * rejected when that gives NaN, so nothing but a number ever reaches the string - and
 * because changing the query is not a port. It is still the one place here that builds SQL
 * by concatenation, which is worth knowing when the next parameter is added: PostgreSQL
 * does not accept a bound parameter in LIMIT in every driver position, which is presumably
 * why it looks like this.
 */
export async function getAutomodRules(logger: Logger, limit?: number, offset?: number): Promise<Rule[]> {
    let query = 'SELECT * FROM rules ORDER BY id DESC';
    if (limit && !isNaN(limit)) query = `${query} LIMIT ${limit}`;
    if (offset && !isNaN(offset)) query = `${query} OFFSET ${offset}`;
    logger.info('Running query', query);
    const rules = await queryAutoMod<Rule>(query);
    return rules.rows;
}

const COLUMNS = 'targets, pattern_type, pattern, points, text_fields, description, game_domain, exclude_mods, exclude_users';

function values(rule: Omit<Rule, 'id'>): unknown[] {
    return [
        rule.targets,
        rule.pattern_type,
        rule.pattern,
        rule.points,
        rule.text_fields,
        rule.description,
        rule.game_domain ?? null,
        rule.exclude_mods ?? null,
        rule.exclude_users ?? null,
    ];
}

export async function createNewRule(rule: Omit<Rule, 'id'>): Promise<Rule> {
    const query = `INSERT INTO rules (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;`;
    const inserted = await queryAutoMod<Rule>(query, values(rule));
    if (!inserted.rows || inserted.rows.length === 0) {
        throw new Error('Failed to insert rule: No rows returned from database');
    }
    return inserted.rows[0];
}

export async function updateRule(rule: Rule, id: number): Promise<Rule> {
    const query = 'UPDATE rules SET targets=$1, pattern_type=$2, pattern=$3, points=$4, text_fields=$5, '
        + 'description=$6, game_domain=$7, exclude_mods=$8, exclude_users=$9 WHERE id=$10 RETURNING *;';
    const updated = await queryAutoMod<Rule>(query, [...values(rule), id ?? rule.id]);
    return updated.rows[0];
}

export async function deleteRule(id: number): Promise<void> {
    await queryAutoMod('DELETE FROM rules WHERE id=$1', [id], 'DeleteAutomodRule');
}
