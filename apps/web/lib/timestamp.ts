/**
 * Timestamp parsing, carried over verbatim from the Express handler.
 *
 * Deliberately identical, including the shape of the fallbacks: this is a tool people
 * paste Discord snowflake-adjacent numbers into, and the whole value of the page is that
 * it agrees with what they already saw. A "tidier" parser here would be a behaviour
 * change dressed up as a port.
 *
 * The ten-digit rule is the useful part: ten digits or fewer is treated as seconds and
 * multiplied up, more than ten as milliseconds. That is what makes 1763499600 and
 * 1763499600000 both mean the same instant.
 */
export function parseToMs(input: string): number {
    if (!input) return Date.now();
    const trimmed = input.trim();

    if (/^-?\d+$/.test(trimmed)) {
        const absLen = trimmed.replace(/^-/, '').length;
        const n = Number(trimmed);
        return absLen <= 10 ? n * 1000 : n;
    }

    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) return parsed;

    const maybeNum = Number(trimmed);
    if (!isNaN(maybeNum)) {
        const absLen = trimmed.replace(/^-|\./g, '').length;
        return absLen <= 10 ? maybeNum * 1000 : maybeNum;
    }

    return Date.now();
}

export const FORMAT: Intl.DateTimeFormatOptions = {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: undefined,
    timeZoneName: 'short',
};

/** UK time for an instant, falling back to the ISO string if Intl refuses the zone. */
export function ukTime(date: Date, iso: string): string {
    try {
        return new Intl.DateTimeFormat('en-GB', { ...FORMAT, timeZone: 'Europe/London' }).format(date);
    }
    catch {
        return iso;
    }
}
