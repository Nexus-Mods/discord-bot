import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/**
 * Load `.env`, wherever it is relative to the code rather than to the shell.
 *
 * Seven modules used to call `dotenv.config()` for themselves, which resolves
 * `.env` from `process.cwd()`. That held for as long as the working directory was
 * always the repository root. The 5.0.0 move put the bot in `apps/bot`, so
 * `npm start` runs with a working directory that has no `.env` in it - and the bot
 * refused to start with "Token encryption is not configured", which is the 4.3.0
 * fail-closed check correctly reporting an environment that had not been loaded.
 *
 * Walking up from this module instead means the answer does not depend on where the
 * command was typed:
 *
 *   development   apps/bot/dist/lib/env.js  ->  ../../../../.env   (repository root)
 *   Docker image  /app/dist/lib/env.js      ->  /app/.env          (mounted)
 *
 * It is the same approach `version.ts` takes to find package.json, and for the same
 * reason: both files sit beside `dist/` in the image and above it in the repository.
 *
 * Nearest wins, so a workspace may keep its own `.env` and override the shared one -
 * but there is deliberately only one today. Two copies of the credentials is the drift
 * the single root file exists to prevent.
 */

/** How far up to look. Four levels covers dist/lib -> dist -> apps/bot -> apps -> root. */
const MAX_DEPTH = 6;

export function findEnvFile(from: string): string | undefined {
    let dir = from;
    for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
        const candidate = path.join(dir, '.env');
        if (existsSync(candidate)) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return undefined;
}

/**
 * The file that was loaded, or undefined when there was none.
 *
 * Undefined is not an error here. Production may inject configuration through the
 * environment rather than a file, and CI has no `.env` at all - `.env` is gitignored.
 * What must never happen is *silently* continuing with a half-loaded environment, and
 * that is what the fail-closed checks at boot are for.
 */
export const ENV_FILE: string | undefined = findEnvFile(path.dirname(fileURLToPath(import.meta.url)));

// quiet: dotenv 17 prints a banner to stdout by default, and production logs are JSON.
// Values already present in the environment win - dotenv does not overwrite them - so a
// container that sets a variable directly is not overridden by a mounted file.
dotenv.config(ENV_FILE ? { path: ENV_FILE, quiet: true } : { quiet: true });
