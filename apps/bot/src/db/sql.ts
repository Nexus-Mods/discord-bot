import { getTableColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { ValidationError } from '../api/errors.js';

/**
 * The column names a table actually has, taken from src/db/schema.ts.
 *
 * schema.ts is verified against production, so this is a trustworthy allow-list and
 * it cannot drift from the database the way a hand-maintained array would.
 */
export function columnNames(table: PgTable): ReadonlySet<string> {
    return new Set(Object.values(getTableColumns(table)).map((c) => c.name));
}

export interface UpdateStatement {
    text: string;
    values: unknown[];
}

/**
 * Build a parameterised UPDATE from a partial object.
 *
 * `updateUser` and `updateServer` both used to interpolate keys straight from
 * `Object.entries(...)` into SQL. That was not exploitable, because every caller
 * passes an object literal built in code - but nothing enforced it, and the types
 * did not either: `updateServer` took `newData: any` at one point, and a
 * `Partial<T>` from a JSON body would have been accepted just as happily.
 *
 * Column names cannot be parameterised in Postgres, so the fix is not bind
 * variables - it is checking each name against the schema before it reaches the
 * string, and quoting it.
 */
export function buildUpdate(
    table: PgTable,
    tableName: string,
    data: Record<string, unknown>,
    where: { column: string; value: unknown },
): UpdateStatement {
    const allowed = columnNames(table);

    // undefined means "not being changed"; null is a real value and is kept.
    const entries = Object.entries(data).filter(([, value]) => value !== undefined);

    if (!entries.length) {
        throw new ValidationError(`No columns to update on ${tableName}`, {
            userMessage: 'Nothing to update.',
        });
    }

    for (const [key] of entries) {
        if (!allowed.has(key)) {
            throw new ValidationError(`Unknown column "${key}" on ${tableName}`, {
                context: { table: tableName, column: key },
                userMessage: 'Could not save those settings.',
            });
        }
    }
    if (!allowed.has(where.column)) {
        throw new ValidationError(`Unknown column "${where.column}" on ${tableName}`, {
            context: { table: tableName, column: where.column },
            userMessage: 'Could not save those settings.',
        });
    }

    const assignments = entries.map(([key], i) => `"${key}" = $${i + 1}`);
    const values = entries.map(([, value]) => value);
    values.push(where.value);

    return {
        text: `UPDATE "${tableName}" SET ${assignments.join(', ')} WHERE "${where.column}" = $${values.length}`,
        values,
    };
}
