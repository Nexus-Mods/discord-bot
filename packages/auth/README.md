# @nexusmods/auth

Both OAuth clients and the signing helpers. This is the package `src/auth/` was created
for in 4.4.0 — that directory existed precisely so these would have somewhere to be that
was not `src/server/`, and the boundary test that has guarded it since is now pointed
here.

## What had to change to get it out

`NexusModsOAuth.getUserData` imported `baseheader` from the application. `baseheader`
carries `Application-Version`, which is read from the bot's `package.json`, which a shared
package cannot resolve — walk up from a package and you find the package's own manifest.
It takes the headers as a parameter now, which is how every query function in
`@nexusmods/nexus-api` already worked.

## Not fixed here

Both clients read `DISCORD_CLIENT_ID`, `NEXUS_OAUTH_ID` and their secrets from
`process.env`, inside the functions rather than at module scope. That means the package
depends on process-global configuration rather than being handed it. It is also why
adding a second Discord application — an admin site with its own consent screen — is
cheap today: a second set of variables and a branch, which is exactly what
`NexusModsOAuth` already does for the legacy and current *Nexus* applications under
`NODE_ENV === 'testing'`. Passing configuration in would be better and is not a move.

`signing.ts` takes `import type express` for its `Request` annotations. Type-only, so the
compiler erases it and no package pulls a web framework into whatever imports it — the
rule the architecture tests enforce.
