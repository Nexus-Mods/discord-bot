import type { Logger } from '../api/logger.js';

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

/**
 * Run async work over a list with at most `limit` in flight.
 *
 * `list.map(async ...)` starts every task immediately, so capping at the
 * Promise.all afterwards caps nothing. This is the version that actually bounds
 * concurrency, which matters where the work is one API request per item.
 *
 * Never rejects: each result is settled, like Promise.allSettled.
 */
export async function mapWithConcurrency<T>(
    items: T[],
    limit: number,
    task: (item: T) => Promise<unknown>,
): Promise<PromiseSettledResult<unknown>[]> {
    if (limit < 1) throw new RangeError('Concurrency limit must be at least 1');

    const results: PromiseSettledResult<unknown>[] = new Array(items.length);
    let next = 0;

    const worker = async (): Promise<void> => {
        while (true) {
            const index = next++;
            if (index >= items.length) return;
            try {
                results[index] = { status: 'fulfilled', value: await task(items[index]) };
            }
            catch (reason) {
                results[index] = { status: 'rejected', reason };
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}
