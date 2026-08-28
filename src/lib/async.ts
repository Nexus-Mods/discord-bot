import { Logger } from '../api/logger.js';

/**
 * Adapt an async function for an API that expects a void-returning callback -
 * setInterval, EventEmitter.on, collector.on - so a rejection is logged instead of
 * becoming an unhandled rejection.
 *
 * `void promise` silences the lint rule but does not handle the rejection; the
 * process still gets an unhandledRejection. This actually catches it.
 */
export function voidAsync<A extends unknown[]>(
    logger: Logger,
    context: string,
    fn: (...args: A) => Promise<unknown>,
): (...args: A) => void {
    return (...args: A) => {
        fn(...args).catch((err) => logger.error(`Unhandled error in ${context}`, err));
    };
}

/**
 * Fire a promise deliberately without waiting for it, logging any rejection.
 * Use where the result genuinely does not affect what happens next.
 */
export function fireAndForget(promise: Promise<unknown>, logger: Logger, context: string): void {
    promise.catch((err) => logger.warn(`Ignored error in ${context}`, err));
}
