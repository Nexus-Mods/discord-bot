import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The version in the nearest package.json above a module.
 *
 * Lifted out of apps/bot/src/version.ts, unchanged, because there are two callers now:
 * the bot's own version, and the `Application-Version` the Nexus API client sends. Two
 * copies of a walk that has already been got wrong once is two chances to get it wrong
 * again.
 *
 * The history is worth keeping attached to it. Everything used to read
 * `process.env.npm_package_version`, which npm sets only when *it* launches the process.
 * That held while the container ran `npm start`; Phase 1 changed the Dockerfile to
 * `CMD ["node", "dist/shards.js"]` so the bot would be PID 1 and receive SIGTERM
 * directly - the right fix, which silently took the variable with it and turned every
 * version display into `0.0.0` or `undefined`, including the header sent to Nexus Mods.
 *
 * Reading package.json does not care how the process was started. What it does care about
 * is *which* package.json it finds, which is why this takes the caller's module URL rather
 * than guessing: called from apps/bot it finds the bot's manifest, called from inside
 * @nexusmods/nexus-api it finds that package's. Both of those are correct answers to
 * different questions, and a helper that picked one for you would be wrong half the time.
 */

/** How far up to look. Four levels covers dist/lib -> dist -> package root and then some. */
const MAX_DEPTH = 6;

export function packageVersionFrom(moduleUrl: string): string {
    let dir = path.dirname(fileURLToPath(moduleUrl));

    for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
        try {
            const raw = readFileSync(path.join(dir, 'package.json'), 'utf8');
            const parsed = JSON.parse(raw) as { version?: unknown };
            if (typeof parsed.version === 'string' && parsed.version.length) {
                return parsed.version;
            }
        }
        catch {
            // Not at this level; keep walking up.
        }

        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }

    // Last resorts, in order of how much they can be trusted.
    return process.env.npm_package_version ?? '0.0.0';
}
