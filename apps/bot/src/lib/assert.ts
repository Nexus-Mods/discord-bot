import { NexusApiError } from '@nexusmods/core/errors.js';

/**
 * Assert that a value the schema allows to be null is actually present.
 *
 * The generated GraphQL types are faithful to the schema, and the schema is a superset
 * of what the API can return in practice. `latestPublishedRevision` is nullable on
 * `Collection`, but it is not mechanically possible for a published collection to have
 * no published revisions - so every read of it would otherwise need a branch inventing
 * behaviour for a state that cannot occur.
 *
 * A silent fallback is the wrong answer there. It renders something plausible and wrong,
 * and it hides the one case worth hearing about: the invariant ceasing to hold because
 * the API changed. This throws instead, naming the invariant, so the failure is
 * attributable rather than a TypeError several frames deep in an embed builder.
 *
 * Use it only where a domain rule guarantees presence. Where a field genuinely can be
 * absent - `tileImage`, `author`, `pictureUrl` - guard it properly instead.
 */
export function assertPresent<T>(value: T | null | undefined, invariant: string): T {
    if (value === null || value === undefined) {
        throw new NexusApiError(`Expected value to be present: ${invariant}`, {
            context: { invariant },
            userMessage: 'Nexus Mods returned unexpected data. Please try again shortly.',
        });
    }
    return value;
}
