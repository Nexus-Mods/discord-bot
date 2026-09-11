import { createRequire } from 'node:module';
import pino, { type Logger as PinoLogger, type LoggerOptions } from 'pino';

/**
 * Logging, backed by pino. The `info(message, data)` shape is unchanged from the logger it
 * replaced, so the ~300 call sites did not move.
 */

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Key names whose values must never reach the logs. Case-insensitive substrings, so
 * `nexus_access`, `discord_refresh` and `Authorization` all match. Over-matching is safe.
 */
const SECRET_FRAGMENTS = [
    'token', 'secret', 'password', 'passwd', 'authorization', 'auth_code',
    'authcode', 'cookie', 'apikey', 'api_key', 'nexus_access', 'nexus_refresh',
    'discord_access', 'discord_refresh', 'credential', 'session',
];

/**
 * Exact-name matches only; as substrings these would redact half the logs. `values` is
 * dbConnect's bind array, which for createUser and updateUser IS the tokens.
 */
const SECRET_EXACT = ['values', 'bindings', 'params'];

const REDACTED = '[redacted]';
const MAX_DEPTH = 6;

function isSecretKey(key: string): boolean {
    const k = key.toLowerCase();
    if (SECRET_EXACT.includes(k)) return true;
    return SECRET_FRAGMENTS.some((fragment) => k.includes(fragment));
}

/** Depth-capped and cycle-safe: discord.js structures reference each other. */
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

/** pino-pretty is a devDependency and absent from the production image after pruning. */
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
 * The legacy (message, data, ...args) shape onto pino's merge object. An Error goes under
 * `err` for the stack; everything else under `data`, where the scrubber reaches it.
 */
function bindings(data: unknown, args: unknown[]): Record<string, unknown> {
    const merge: Record<string, unknown> = {};
    if (data instanceof Error) merge.err = data;
    else if (data !== undefined) merge.data = data;
    // The old logger accepted trailing arguments and silently dropped them.
    if (args.length) merge.extra = args;
    return merge;
}

/** The process-wide logger. Here, not DiscordBot.ts, so logging does not import the client. */
export const logger = new Logger(process.env.SHARD_ID ?? 'Main');
