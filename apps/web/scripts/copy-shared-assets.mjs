// Bring the Express site's images into apps/web/public for the duration of the port.
//
// The eight views share four SVG icons and four animated GIFs, and the GIFs are 5.8MB.
// Committing a second copy would put that 5.8MB in the history permanently to serve a
// duplicate that step 9 deletes - git does not forget a blob because a later commit
// removes it. So the copy is generated at build time and gitignored, and there is exactly
// one copy of each image under version control.
//
// This is the only edge from apps/web to apps/bot and it is a build-time file copy, not
// an import. It ends at step 9, when Express is deleted and these files move here for
// real.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const from = path.join(here, '..', '..', 'bot', 'src', 'server', 'public', 'images');
const to = path.join(here, '..', 'public', 'images');

if (!existsSync(from)) {
    // Not fatal. The bot's public directory disappears at step 9, and when it does this
    // script should stop being run rather than start failing builds.
    console.log(`copy-shared-assets: nothing at ${path.relative(process.cwd(), from)}; skipping`);
    process.exit(0);
}

mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log(`copy-shared-assets: ${readdirSync(to).length} file(s) -> apps/web/public/images`);
