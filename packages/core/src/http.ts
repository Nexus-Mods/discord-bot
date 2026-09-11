/**
 * fetch's Response.json() is typed as unknown, which is correct: the body is
 * whatever the server chose to send.
 *
 * Until 4.0.0 the tsconfig omitted "lib", so TypeScript silently pulled in the DOM
 * library in a Node-only project and json() resolved to `any`. Every response body
 * was therefore trusted without anyone deciding to trust it. This helper keeps the
 * assertion in one place so the trust boundary is greppable.
 */
export async function readJson<T>(response: Response): Promise<T> {
    return (await response.json()) as T;
}

/**
 * Turn an OAuth `expires_in` (seconds from now) into an absolute timestamp.
 *
 * `expires_in` is optional in every provider response we model. The previous
 * `Date.now() + expires_in * 1000` produced NaN when it was absent, and because
 * every comparison against NaN is false, `Date.now() > expires_at` never fired -
 * so such a token would never have been refreshed. Treating a missing value as
 * "already expired" fails in the safe direction instead.
 */
export function expiresAt(expiresIn: number | undefined): number {
    return Date.now() + (expiresIn ?? 0) * 1000;
}
