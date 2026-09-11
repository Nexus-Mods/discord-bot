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
 * Alternatives, not a pair: both serve the same paths on port 3000, so the registered
 * redirect URIs work for either.
 *
 * One build, then both processes - running the two dev scripts in separate terminals does
 * not work, because tsup cleans dist/ and the second build deletes what the first is
 * running from.
 *
 * The bot always runs sharded. BOT_SHARD_COUNT=1 for one shard; NODE_ENV=testing gives two.
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
     * Started through npm from its own workspace: `next dev` needs apps/web as its working
     * directory, and predev copies the shared images first. shell on Windows, where npm is
     * a .cmd that spawn will not otherwise find.
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
        // Half a pair is not a useful state: a web server still answering after the bot
        // died on a bad token is just confusing.
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
    // Closing the HTTP server and the pools is not instant; give both a moment.
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
