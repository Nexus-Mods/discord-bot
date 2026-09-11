# @nexusmods/nexus-api

Everything the bot uses to talk to Nexus Mods. Fifteen v2 GraphQL operation modules, the
types generated from `schema.graphql`, and the response shapes for the two endpoints that
are not GraphQL at all.

## Not here: `http.ts`

The plan counted `api/http.ts` as the sixteenth module of this package. It is two
functions — `readJson` and `expiresAt` — with no imports, and three of its four callers
are not Nexus Mods code: both OAuth clients and the forum API. A generic HTTP helper
living in the Nexus API client, imported by the *Discord* OAuth client, is a boundary that
would need undoing later. It stays in `apps/bot` until the auth package is cut, which is
where it is actually needed and where it will land in `@nexusmods/core`.

## Codegen

`codegen.ts` and `schema.graphql` moved with the operations, because the generated output
is part of this package and generating it from the application would have been a build
step pointing the wrong way.

```
npm run codegen -w @nexusmods/nexus-api
```

The schema is committed rather than introspected, for the reasons in `codegen.ts`. The
generated files are committed too, and `codegen:check` fails if they drift.

## Imports

```ts
import { v2 } from '@nexusmods/nexus-api/queries/all.js';
import type { IStatusPageFullResponse } from '@nexusmods/nexus-api/types/responses.js';
```
