/**
 * Load the repository's .env before anything reads it.
 *
 * Next reads .env files from its own project directory - apps/web - and the one .env this
 * repository has is at the root, so none of it reached this process. `npm run dev:web`
 * came up and then refused to serve: COOKIE_SECRET and UNLINK_SECRET are in that file and
 * the boot check could not see them.
 *
 * This is the 5.0.0 bug again in a new app. Seven modules used to call dotenv.config(),
 * which resolves from the working directory; @nexusmods/core/env.js exists because that
 * broke when the bot moved into apps/bot. A whole new application was then built without
 * importing it - and the same class of failure came back, found the same way, by a check
 * that fails closed.
 *
 * next.config.ts because it is the earliest thing Next evaluates and it evaluates it for
 * all three of `next dev`, `next build` and `next start`. Side-effect import, first, for
 * the same reason the bot's entry points do it first: this has to populate process.env
 * before any module that reads it is evaluated.
 */
import '@nexusmods/core/env.js';
import type { NextConfig } from 'next';

const config: NextConfig = {
    // Fail the build on a type error rather than shipping one. Next's default already
    // does this; stated because the opposite is a common escape hatch and turning it on
    // should be a decision rather than a default nobody looked at.
    typescript: { ignoreBuildErrors: false },
};

export default config;
