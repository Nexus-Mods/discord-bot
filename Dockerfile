# ---- build ----
FROM node:22-slim AS build
WORKDIR /repo

# The lockfile is at the workspace root and covers every workspace, so both it and the
# root manifest are needed before install. apps/*/package.json come with them because
# npm reads each workspace's manifest to resolve the tree.
COPY package.json package-lock.json ./
COPY apps/bot/package.json ./apps/bot/
# Every workspace the bot depends on needs its manifest here too, for the same
# reason: npm resolves the tree from the manifests before any source is copied.
COPY packages/core/package.json ./packages/core/
COPY packages/nexus-api/package.json ./packages/nexus-api/
COPY packages/auth/package.json ./packages/auth/
# npm ci installs exactly what the lockfile pins, dev dependencies included so
# tsup and typescript are available for the build.
#
# Scoped to the bot's workspace. Without --workspace this installs every workspace,
# which since 5.0.0 means the runtime image carries Next and React - 200MB the bot
# cannot use, copied into it by the wholesale node_modules COPY below. The flag also
# means apps/web/package.json need not be in the build context at all.
RUN npm ci --workspace @nexusmods/discord-bot --include-workspace-root

COPY . .
RUN npm run typecheck -w @nexusmods/discord-bot \
 && npm run build -w @nexusmods/discord-bot

# Drop dev dependencies so only what the bot needs at runtime is carried forward.
RUN npm prune --omit=dev

# npm links workspace dependencies rather than installing them, and the runtime stage
# copies node_modules without packages/ - so the links would dangle. Replace them with
# the built packages, which is what lets the runtime image keep the shape it has had
# since 4.0.0 rather than growing a packages/ directory beside dist/.
RUN node scripts/flatten-workspace-deps.mjs apps/bot

# ---- runtime ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# The runtime image deliberately keeps the pre-5.0.0 shape: dist/, node_modules/ and
# package.json directly under /app. The repository moved the bot to apps/bot; the image
# did not. That keeps `node dist/shards.js` correct, which means redeploy.sh, the
# compose files and DEPLOYING.md all continue to describe what actually runs - the
# alternative was changing the deploy path in the same release that restructured the
# repository, and the deploy path had only just been committed.
#
# node_modules comes from the workspace root because npm hoists there; apps/bot has no
# node_modules of its own to copy.
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/bot/dist ./dist
# The bot's manifest, not the root's: version.ts walks up from dist/ looking for a
# package.json with a version, and BOT_VERSION ends up in the Application-Version
# header sent to Nexus Mods.
COPY --from=build /repo/apps/bot/package.json ./package.json

# Do not run as root.
USER node

# Exec form, so the process is PID 1 and receives SIGTERM directly. The previous
# shell form put /bin/sh at PID 1, which swallowed the signal - `docker stop` had
# to wait out its timeout and then SIGKILL the bot mid-poll.
CMD ["node", "dist/shards.js"]
