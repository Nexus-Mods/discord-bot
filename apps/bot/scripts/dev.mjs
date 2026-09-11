import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

/** Sentinel for the Next site, which is started by workspace rather than by file path. */
const NEXT = Symbol('next');

/**
 * Runs the bot and one of the two auth sites together for local development.
 *
 *     npm run dev:all     the bot and Express      (dist/web.js)
 *     npm run dev:next    the bot and the Next app (apps/web)
 *
 * Both serve the same paths on the same port, so they are alternatives rather than a
 * pair: whichever is running answers http://localhost:3000, and DISCORD_REDIRECT_URI and
 * NEXUS_REDIRECT_URI point there either way. That is what makes the two comparable - the
 * Next routes deliberately kept Express's paths, so the applications registered with
 * Discord and Nexus Mods need no change to try the other one.
 *
 * They are two processes now, and the obvious way to start them - `npm run devShard`
 * in one terminal and `npm run devWeb` in another - does not work: both scripts run
 * `tsup`, which is configured with `clean: true`, so the second build deletes the
 * output the first one is running from. This builds once, then starts both.
 *
 * The bot always runs under the sharding manager, here as in production - dist/app.js
 * is the shard child and refuses to start on its own. Set BOT_SHARD_COUNT=1 for a
 * single shard; NODE_ENV=testing gives two.
 */

const BOT_ENTRY = 'dist/shards.js';

/** `--next` swaps Express for the Next development server. */
const USE_NEXT = process.argv.includes('--next');

const TAGS = {
    bot: { label: 'bot', colour: '\x1b[36m' },   // cyan
    web: { label: 'web', colour: '\x1b[35m' },   // magenta
};
const RESET = '\x1b[0m';

function run(command, args, options = {}) {
    return spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32', ...options });
}

/** Pipe a child's output through, prefixed, so two interleaved logs stay readable. */
function pipeTagged(child, tag) {
    const { label, colour } = TAGS[tag];
    const prefix = `${colour}[${label}]${RESET} `;
    for (const stream of [child.stdout, child.stderr]) {
        if (!stream) continue;
        let buffered = '';
        stream.setEncoding('utf8');
        stream.on('data', (chunk) => {
            buffered += chunk;
            const lines = buffered.split('\n');
            // Keep the trailing fragment; it is completed by the next chunk.
            buffered = lines.pop() ?? '';
            for (const line of lines) process.stdout.write(prefix + line + '\n');
        });
        stream.on('end', () => { if (buffered) process.stdout.write(prefix + buffered + '\n'); });
    }
}

async function build() {
    console.log('Building once, so the two processes share one dist/...');
    const code = await new Promise((resolve) => {
        run('npm', ['run', 'build']).on('exit', resolve);
    });
    if (code !== 0) {
        console.error(`Build failed (exit ${code}).`);
        process.exit(code ?? 1);
    }
}

await build();

const children = new Map();
let stopping = false;

function start(tag, entry) {
    /**
     * The Next site is started through npm from its own workspace rather than by path:
     * `next dev` needs apps/web as its working directory, and its predev step copies the
     * shared images across before it serves them.
     *
     * shell on Windows, because npm is a .cmd there and spawn will not find it otherwise -
     * the same reason run() above does it.
     */
    const child = entry === NEXT
        ? spawn('npm', ['run', 'dev', '-w', '@nexusmods/discord-web'], {
            cwd: path.resolve(import.meta.dirname, '..', '..', '..'),
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: process.platform === 'win32',
            env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' },
        })
        : spawn(process.execPath, [entry], {
            stdio: ['ignore', 'pipe', 'pipe'],
            // pino-pretty drops colour when its output is a pipe rather than a terminal.
            env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' },
        });
    pipeTagged(child, tag);
    children.set(tag, child);

    child.on('exit', (code, signal) => {
        children.delete(tag);
        if (stopping) return;
        // One half of a pair is not a useful state to leave a developer in: if the bot
        // dies on a bad token, a web server still answering is just confusing.
        console.log(`\n${TAGS[tag].label} exited (${signal ?? `code ${code}`}). Stopping the other.`);
        stopAll();
        process.exitCode = code ?? 1;
    });

    return child;
}

function stopAll() {
    if (stopping) return;
    stopping = true;
    for (const child of children.values()) child.kill('SIGTERM');
    // The web process closes its HTTP server and database pools on SIGTERM, which is
    // not instant. Give both a moment before insisting.
    setTimeout(() => {
        for (const child of children.values()) child.kill('SIGKILL');
    }, 5000).unref();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        console.log(`\nReceived ${signal}, shutting both down...`);
        stopAll();
    });
}

const web = USE_NEXT ? NEXT : 'dist/web.js';

start('bot', BOT_ENTRY);
start('web', web);

console.log(`Started ${BOT_ENTRY} and ${USE_NEXT ? 'the Next site (apps/web)' : web}. Ctrl+C stops both.`);
console.log(`The site is on http://localhost:3000 either way.\n`);
