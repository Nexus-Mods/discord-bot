import { version } from '../package.json';

/**
 * The version this site reports.
 *
 * Imported from the manifest rather than resolved with
 * `packageVersionFrom(import.meta.url)` the way the bot does it. The bot's walk is a
 * runtime filesystem climb from the running module, and inside a Next build the running
 * module is a bundled chunk whose path is a build detail - `.next/server/app/...` in one
 * layout and something else in a standalone output. A JSON import is resolved when the
 * bundle is built, which is when the answer is already known.
 *
 * It is apps/web's version, and the page shows it where Express showed BOT_VERSION. Those
 * are the same string because every workspace here is released together, and there is an
 * architecture test that fails by name if one drifts - so this is the bot's version too,
 * for a reason rather than by luck.
 */
export const WEB_VERSION: string = version;
