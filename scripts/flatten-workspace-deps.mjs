// Replace the workspace symlinks in node_modules with the real thing.
//
// npm links a workspace dependency: node_modules/@nexusmods/core is a symlink to
// ../../packages/core. That is right for development and wrong for the runtime image,
// which copies node_modules to /app/node_modules and nothing else - the link would point
// at /app/packages/core, which is not there.
//
// Copying the packages in as well would work and would also put their sources, their
// configs and a second node_modules layout into the image. Flattening instead keeps the
// image exactly the shape it has had since 4.0.0 - dist/, node_modules/ and package.json
// under /app, `node dist/shards.js` still correct - which is what lets the Phase 4 plan
// leave the deploy path untouched until step 9.
//
// Runs in the build stage after `npm prune --omit=dev`, because prune rewrites the tree.
//
//   node scripts/flatten-workspace-deps.mjs [workspace-dir]   (default: apps/bot)
import { cpSync, existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, rmSync } from 'node:fs';
import path from 'node:path';

const SCOPE_DIR = path.join('node_modules', '@nexusmods');
const workspace = process.argv[2] ?? path.join('apps', 'bot');

/**
 * Only what this workspace actually depends on.
 *
 * The first version of this walked every link in the scope, which meant it also found
 * @nexusmods/discord-bot - npm links a workspace to itself - and @nexusmods/discord-web,
 * a Next app the bot image has no use for and which has no dist/ to copy. It failed on
 * the third link having done two, leaving node_modules half rewritten. Reading the
 * dependency list says what is wanted instead of inferring it from what happens to be
 * linked.
 */
const manifest = JSON.parse(readFileSync(path.join(workspace, 'package.json'), 'utf8'));
const wanted = Object.keys(manifest.dependencies ?? {}).filter((d) => d.startsWith('@nexusmods/'));

if (wanted.length === 0) {
    console.log(`flatten: ${workspace} has no @nexusmods dependencies; nothing to do`);
    process.exit(0);
}

for (const dep of wanted) {
    const link = path.join('node_modules', dep);
    if (!existsSync(path.dirname(link))) throw new Error(`flatten: ${dep} is not installed`);
    if (!lstatSync(link).isSymbolicLink()) {
        console.log(`flatten: ${dep} is already a real directory; leaving it`);
        continue;
    }

    const source = path.resolve(path.dirname(link), readlinkSync(link));
    if (!existsSync(path.join(source, 'dist'))) {
        throw new Error(`flatten: ${dep} has no dist/ at ${source} - build it before flattening`);
    }

    rmSync(link);
    cpSync(path.join(source, 'package.json'), path.join(link, 'package.json'));
    cpSync(path.join(source, 'dist'), path.join(link, 'dist'), { recursive: true });
    console.log(`flatten: ${dep} <- ${path.relative(process.cwd(), source)}`);
}

// Anything still linked in the scope is another workspace that this one does not depend
// on - the self-link, and any sibling app. Left in place they would be copied into the
// image as symlinks pointing at directories that are not there: dangling entries that
// resolve to nothing and exist only to confuse whoever finds them.
for (const name of existsSync(SCOPE_DIR) ? readdirSync(SCOPE_DIR) : []) {
    const entry = path.join(SCOPE_DIR, name);
    if (!lstatSync(entry).isSymbolicLink()) continue;
    rmSync(entry);
    console.log(`flatten: dropped the dangling link @nexusmods/${name}`);
}

console.log(`flatten: ${wanted.length} package(s) for ${workspace}`);
