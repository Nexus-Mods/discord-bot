# @nexusmods/core

The cross-cutting five, minus one. `errors`, `logger`, `formatting` and `env`: the things
both the Discord bot and the web app need and neither owns.

Cut first, ahead of the Nexus API client the plan named first, because the sixteen query
modules import `errors` and `logger` at runtime — a package cannot depend on the
application it was cut from, so the order was forced by the dependency direction rather
than chosen.

## What is deliberately not here

`version.ts` reads the version by walking up from its own file until it finds a
`package.json`. Moved here, it would find *this* package's manifest — `@nexusmods/core`'s
version, not the bot's — and because the two are versioned together today it would return
the right string for the wrong reason and start lying the moment they diverge. It stays in
`apps/bot`, where the file it is looking for is the file it means.

`api/util.ts` is a grab-bag: Nexus API request headers, mod-UID arithmetic, a
`KnownDiscordServers` enum used by eleven interaction handlers, and re-exports of three
formatting helpers. Splitting it is worth doing when the web app actually needs
`baseheader`, and not before.

## Imports

Subpath exports, one per module, mirroring the paths these files already had:

```ts
import { logger } from '@nexusmods/core/logger.js';
import { NexusApiError } from '@nexusmods/core/errors.js';
```

Types resolve from `src/`, the runtime from `dist/`. That means `npm run typecheck` needs
no build to have happened first, and no `.d.ts` is generated or checked in.
