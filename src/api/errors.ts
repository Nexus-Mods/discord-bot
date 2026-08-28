/**
 * One error vocabulary for the whole bot.
 *
 * Before 4.0.0 the data layer alone used five mutually incompatible conventions:
 * swallow-and-return-empty; mutate the caught error's message and rethrow it;
 * Promise.reject with a string or a bare `false`; wrap in a generic Error and throw
 * away the cause; and handleDatabaseError, which was typed to return `string`, so
 * `throw handleDatabaseError(err)` threw a bare string with no stack and every
 * downstream `(err as Error).message` was undefined.
 *
 * Everything thrown from this codebase is now an Error subclass that keeps its
 * cause, carries a machine-readable code, and separates the message meant for the
 * logs from the message safe to show a user.
 */

export type ErrorCode =
    | 'DATABASE'
    | 'NEXUS_API'
    | 'DISCORD_API'
    | 'NOT_FOUND'
    | 'CONFIG'
    | 'VALIDATION'
    | 'UNKNOWN';

export interface AppErrorOptions {
    code?: ErrorCode;
    /** The original failure. Preserved so stack traces chain rather than reset. */
    cause?: unknown;
    /** Safe to render in Discord or on the website. Never include internals here. */
    userMessage?: string;
    /**
     * True for expected failures (a timeout, a missing row, a 404) and false for
     * bugs. Lets the interaction handler decide between "retry in a minute" and
     * "please report this".
     */
    isOperational?: boolean;
    /** Structured detail for the logs. Scrubbed by the logger before output. */
    context?: Record<string, unknown>;
}

const DEFAULT_USER_MESSAGE = 'Something went wrong. Please try again in a few minutes.';

export class AppError extends Error {
    readonly code: ErrorCode;
    readonly userMessage: string;
    readonly isOperational: boolean;
    readonly context?: Record<string, unknown>;

    constructor(message: string, options: AppErrorOptions = {}) {
        super(message, { cause: options.cause });
        this.name = new.target.name;
        this.code = options.code ?? 'UNKNOWN';
        this.userMessage = options.userMessage ?? DEFAULT_USER_MESSAGE;
        this.isOperational = options.isOperational ?? true;
        this.context = options.context;
        Error.captureStackTrace?.(this, new.target);
    }
}

export class DatabaseError extends AppError {
    constructor(message: string, options: Omit<AppErrorOptions, 'code'> = {}) {
        super(message, { ...options, code: 'DATABASE' });
    }
}

export class NexusApiError extends AppError {
    constructor(message: string, options: Omit<AppErrorOptions, 'code'> = {}) {
        super(message, { ...options, code: 'NEXUS_API' });
    }
}

export class DiscordApiError extends AppError {
    constructor(message: string, options: Omit<AppErrorOptions, 'code'> = {}) {
        super(message, { ...options, code: 'DISCORD_API' });
    }
}

export class NotFoundError extends AppError {
    constructor(message: string, options: Omit<AppErrorOptions, 'code'> = {}) {
        super(message, { ...options, code: 'NOT_FOUND', userMessage: options.userMessage ?? message });
    }
}

export class ConfigError extends AppError {
    constructor(message: string, options: Omit<AppErrorOptions, 'code'> = {}) {
        // A missing or wrong environment variable is a deployment bug, not a blip.
        super(message, { ...options, code: 'CONFIG', isOperational: false });
    }
}

/**
 * Normalise anything caught into an Error. Necessary because this codebase used to
 * throw strings, booleans and template literals, and because a `catch` binding is
 * `unknown` regardless.
 */
export function toError(value: unknown): Error {
    if (value instanceof Error) return value;
    if (typeof value === 'string') return new Error(value);
    try {
        return new Error(JSON.stringify(value));
    }
    catch {
        return new Error(String(value));
    }
}

/** The message to show a user for any caught value. */
export function userMessageFor(value: unknown): string {
    if (value instanceof AppError) return value.userMessage;
    return DEFAULT_USER_MESSAGE;
}
