import { createRequire } from 'node:module';
import pino, { type Logger as PinoLogger, type LoggerOptions } from 'pino';

/**
 * Logging for the bot, backed by pino.
 *
 * The public shape - info(message, data) - is deliberately unchanged from the
 * hand-rolled logger it replaces, so the ~300 existing call sites did not have to
 * move. What changed underneath: real levels, JSON output in production, stack
 * traces on errors, and redaction of anything that looks like a credential.
 */

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Key names whose values must never reach the logs. Matched case-insensitively as
 * substrings, so `nexus_access`, `discord_refresh`, `NexusModsOAuthTokens` and
 * `Authorization` are all caught. Over-matching here is the safe direction.
 *
 * This exists because the old logger printed whatever it was handed: dbConnect
 * logged the query values array, which for createUser and updateUser is the OAuth
 * token array, and users.ts logged an entire DiscordBotUser.
 */
const SECRET_FRAGMENTS = [
    'token', 'secret', 'password', 'passwd', 'authorization', 'auth_code',
    'authcode', 'cookie', 'apikey', 'api_key', 'nexus_access', 'nexus_refresh',
    'discord_access', 'discord_refresh', 'credential', 'session',
];

/**
 * Keys that are only dangerous under their exact name, so they cannot go in the
 * substring list above without redacting half the logs. `values` is the bind array
 * dbConnect passes to pg - for createUser and updateUser that array IS the tokens.
 */
const SECRET_EXACT = ['values', 'bindings', 'params'];

const REDACTED = '[redacted]';
const MAX_DEPTH = 6;

function isSecretKey(key: string): boolean {
    const k = key.toLowerCase();
    if (SECRET_EXACT.includes(k)) return true;
    return SECRET_FRAGMENTS.some((fragment) => k.includes(fragment));
}

/**
 * Walk a value and replace anything under a credential-shaped key. Depth-capped
 * and cycle-safe, because the objects handed to the logger include discord.js
 * structures that reference each other.
 */
export function scrub(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (depth >= MAX_DEPTH) return '[max depth reached]';
    if (seen.has(value)) return '[circular]';
    seen.add(value);

    if (value instanceof Error) return pino.stdSerializers.errWithCause(value);
    if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1, seen));
    if (value instanceof Map) return `[Map size=${value.size}]`;
    if (value instanceof Set) return `[Set size=${value.size}]`;

    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        out[key] = isSecretKey(key) ? REDACTED : scrub(v, depth + 1, seen);
    }
    return out;
}

/**
 * pino-pretty runs in a worker thread, which is unwanted in tests and absent from
 * the production image after `npm prune --omit=dev`. Resolve it defensively rather
 * than crashing at startup if it is not there.
 */
function prettyTransport(): LoggerOptions['transport'] {
    if (isProduction || isTest) return undefined;
    try {
        createRequire(import.meta.url).resolve('pino-pretty');
        return {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:yyyy-mm-dd HH:MM:ss', ignore: 'pid,hostname' },
        };
    }
    catch {
        return undefined;
    }
}

const root = pino({
    level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
    // pid and hostname add nothing here; the shard binding is what identifies a line.
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
        err: pino.stdSerializers.errWithCause,
        data: (d: unknown) => scrub(d),
        extra: (d: unknown) => scrub(d),
    },
    transport: prettyTransport(),
});

export class Logger {
    private log: PinoLogger;

    constructor(shardId: string = 'Main') {
        this.log = root.child({ shard: shardId });
    }

    public setShardId(shardId: string): void {
        this.log = root.child({ shard: shardId });
    }

    /** A logger carrying extra context on every line, e.g. { guild, command }. */
    public child(bindings: Record<string, unknown>): Logger {
        const c = new Logger();
        c.log = this.log.child(bindings);
        return c;
    }

    public info(message: string, data?: unknown, ...args: unknown[]): void {
        this.log.info(bindings(data, args), message);
    }

    public warn(message: string, data?: unknown, ...args: unknown[]): void {
        this.log.warn(bindings(data, args), message);
    }

    public error(message: string, data?: unknown, ...args: unknown[]): void {
        this.log.error(bindings(data, args), message);
    }

    public debug(message: string, data?: unknown, ...args: unknown[]): void {
        this.log.debug(bindings(data, args), message);
    }
}

/**
 * Map the legacy (message, data, ...args) call shape onto pino's merge object.
 * An Error goes under `err` so pino serialises the stack; everything else goes
 * under `data`, where the scrubbing serializer can reach it.
 */
function bindings(data: unknown, args: unknown[]): Record<string, unknown> {
    const merge: Record<string, unknown> = {};
    if (data instanceof Error) merge.err = data;
    else if (data !== undefined) merge.data = data;
    // The old logger accepted trailing arguments and silently dropped them.
    if (args.length) merge.extra = args;
    return merge;
}

/**
 * The process-wide logger. Lives here rather than in DiscordBot.ts, which is where
 * it used to be exported from - that made the data layer import the Discord client
 * module just to log, so nothing under api/ could be imported without booting the
 * bot.
 */
export const logger = new Logger(process.env.SHARD_ID ?? 'Main');
