/**
 * Reading the query string, once.
 *
 * Next hands `searchParams` to a page as a promise of a record whose values are `string |
 * string[] | undefined`, because `?e=a&e=b` is legal and produces an array. Every page
 * here wants one string, and a page that forgets the array case renders "a,b" - or, in the
 * error pages, puts an attacker's two-element array into a <pre>.
 *
 * These pages take their inputs from the query string only until step 7 gives them a real
 * data path. Treating everything in here as text someone else wrote is not caution about
 * that interim - it is the permanent rule, since the query string stays attacker-supplied
 * after the flow behind it is real.
 */
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The first value for a key, or undefined. Arrays collapse to their first element. */
export function one(value: string | string[] | undefined): string | undefined {
    const first = Array.isArray(value) ? value[0] : value;
    return first === undefined || first === '' ? undefined : first;
}

/**
 * A value safe to put inside an href.
 *
 * Discord snowflakes and Nexus Mods user ids are both decimal integers, so anything that
 * is not one is not an id, and `discord://` and profile URLs are not places to
 * interpolate arbitrary query-string content.
 */
export function numericId(value: string | undefined): string | undefined {
    return value && /^\d{1,32}$/.test(value) ? value : undefined;
}
