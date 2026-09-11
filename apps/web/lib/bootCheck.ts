import { OPTIONAL_SECRETS, REQUIRED_SECRETS } from '@nexusmods/auth/signing.js';
import { logger } from '@nexusmods/core/logger.js';
import type { Env } from '@/lib/security/clientIp';

/**
 * What `AuthSite.initialize` checked before Express would serve a request.
 *
 * Kept out of instrumentation.ts so the decision is testable without starting a server -
 * and because Turbopack statically analyses instrumentation.ts for the Edge build and
 * warns about `process.exit` even inside a `NEXT_RUNTIME === 'nodejs'` guard. It does not
 * follow dynamic imports, so the hook importing this is both tidier and quieter.
 */

export interface BootProblems {
    /** Required secrets that are absent. Any of these and the site must not serve. */
    missing: { name: string; reason: string }[];
    /** Optional secrets that are absent. The endpoints they guard will reject everything. */
    unguarded: string[];
    /** True when the client address cannot be established and the rate limits merge. */
    proxyUnknown: boolean;
}

/**
 * Required by this application on top of the shared list, because `PORT` means something
 * different here than it does in the bot.
 *
 * The database port is `DBPORT ?? PORT`. That fallback exists because deployed
 * environments set PORT, and it was harmless while PORT was only ever the database's -
 * the repository's own .env has `PORT=5432` and no DBPORT, and the bot has always been
 * fine on it.
 *
 * It stops being harmless here. The Next server reads PORT to decide what to listen on,
 * so the web container sets `PORT=3000` - and with DBPORT unset that silently becomes the
 * database port too. The container starts, serves pages, and fails every query: no
 * account links, no tracking page, no automod. Verified: with DBPORT unset and PORT=3000,
 * poolConfig().port is 3000.
 *
 * So DBPORT is not optional in this process. One line in .env, which .env.example has
 * carried all along, and the ambiguity is gone rather than avoided.
 */
const WEB_REQUIRED: ReadonlyArray<{ name: string; reason: string }> = [
    {
        name: 'DBPORT',
        reason: 'PORT is the HTTP port in this process, so the database port has to be named unambiguously',
    },
];

/** Pure. Given an environment, what is wrong with it. */
export function inspectEnvironment(env: Env): BootProblems {
    return {
        missing: [...REQUIRED_SECRETS, ...WEB_REQUIRED]
            .filter(({ name }) => !env[name]).map(({ name, reason }) => ({ name, reason })),
        unguarded: OPTIONAL_SECRETS.filter((name) => !env[name]),
        proxyUnknown: env.NODE_ENV === 'production' && !env.TRUST_PROXY,
    };
}

/**
 * Report, and refuse to run if the site cannot work.
 *
 * Exits rather than throws. Express got the same property for free - AuthSite's
 * constructor threw, nothing caught it, the process died, the container exited non-zero
 * and `restart: unless-stopped` made a bad deploy visible. Next catches whatever the
 * instrumentation hook throws, logs "Failed to prepare server", and keeps listening, so a
 * misconfigured site stays up answering 500 to every request and a port check calls it
 * healthy. Verified before this was written: throwing did exactly that.
 */
export function runBootCheck(env: Env = process.env): void {
    const problems = inspectEnvironment(env);

    if (problems.missing.length > 0) {
        for (const { name, reason } of problems.missing) {
            logger.error(`${name} is not set. ${reason}, so the site cannot start.`);
        }
        process.exit(1);
    }

    for (const name of problems.unguarded) {
        logger.warn(`${name} is not set - the endpoints it guards will reject every request.`);
    }

    /**
     * Not fatal, but the loudest warning here.
     *
     * With no TRUST_PROXY the client address cannot be established, every visitor shares
     * one rate-limit bucket, and the first busy one locks out the rest. Express had the
     * same failure and no warning for it: `req.ip` quietly became the proxy's address.
     */
    if (problems.proxyUnknown) {
        logger.warn(
            'TRUST_PROXY is not set. Every request will look like it came from the same client, '
            + 'so the rate limits apply to all visitors together rather than to each of them.',
        );
    }
}
