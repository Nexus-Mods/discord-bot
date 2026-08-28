# ---- build ----
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
# npm ci installs exactly what the lockfile pins, dev dependencies included so
# tsup and typescript are available for the build.
RUN npm ci

COPY . .
RUN npm run typecheck && npm run build

# Drop dev dependencies so only what the bot needs at runtime is carried forward.
RUN npm prune --omit=dev

# ---- runtime ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Do not run as root.
USER node

# Exec form, so the process is PID 1 and receives SIGTERM directly. The previous
# shell form put /bin/sh at PID 1, which swallowed the signal - `docker stop` had
# to wait out its timeout and then SIGKILL the bot mid-poll.
CMD ["node", "dist/shards.js"]
