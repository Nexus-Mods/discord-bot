import { cp } from 'node:fs/promises';

// The auth site resolves its views and static files relative to the compiled
// file's directory, so they have to sit alongside it in dist/.
// The old copyfiles invocations used `-f` (flatten) with single-level globs, so
// anything in a subdirectory was silently dropped. fs.cp is recursive and keeps
// the structure.
const assets = [
    ['src/server/views', 'dist/server/views'],
    ['src/server/public', 'dist/server/public'],
];

for (const [from, to] of assets) {
    await cp(from, to, { recursive: true });
    console.log(`copied ${from} -> ${to}`);
}
