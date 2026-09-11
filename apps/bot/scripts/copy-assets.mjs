import { cp } from 'node:fs/promises';

// The runtime image only copies dist/, so the migration SQL has to live inside it or the
// bot starts with no migrations to apply.
const assets = [
    ['drizzle', 'dist/drizzle'],
];

for (const [from, to] of assets) {
    await cp(from, to, { recursive: true });
    console.log(`copied ${from} -> ${to}`);
}
