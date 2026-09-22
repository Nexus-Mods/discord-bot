#!/bin/sh
set -eu

BOT_IMAGE_NAME="nexusmods/discord-bot"
WEB_IMAGE_NAME="nexusmods/discord-bot-web"
TAG="${1:-latest}"
BOT_IMAGE="${BOT_IMAGE_NAME}:${TAG}"
WEB_IMAGE="${WEB_IMAGE_NAME}:${TAG}"

ENV_FILE="$PWD/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "No .env found at $ENV_FILE - run this from the directory that holds it." >&2
    exit 1
fi

# DBPORT must be set, because the web container sets PORT=3000 for its HTTP server and the
# database port falls back to PORT. This cannot check the VALUE - set it to whatever PORT
# already holds in this file, not to 5432.
if ! grep -q '^DBPORT=' "$ENV_FILE"; then
    echo "DBPORT is not set in $ENV_FILE." >&2
    echo "Set it to the same value PORT already has in that file - that is the database" >&2
    echo "port. It is not 5432 on this deployment." >&2
    exit 1
fi

echo "Pulling $BOT_IMAGE"
docker pull "$BOT_IMAGE"
echo "Pulling $WEB_IMAGE"
docker pull "$WEB_IMAGE"

for c in bot web; do docker rm -f "$c" >/dev/null 2>&1 || true; done

echo "Starting bot"

docker run -d --name bot --restart unless-stopped --network host -v "$ENV_FILE:/app/.env" "$BOT_IMAGE" node dist/shards.js

echo "Starting web"
# HOSTNAME=0.0.0.0 is required. The standalone server binds an address, not just a port,
# and takes it from HOSTNAME - which Docker sets to the host's name under --network host,
# and which Debian maps to 127.0.1.1. Without it the site binds 127.0.1.1:3000, reports
# itself ready, and refuses every connection from the proxy.
docker run -d --name web --restart unless-stopped --network host -v "$ENV_FILE:/app/.env" -e PORT=3000 -e HOSTNAME=0.0.0.0 "$WEB_IMAGE" node server.js

docker image prune -f

echo
echo "Deployed $TAG. Both containers should be up:"
docker ps --filter name=bot --filter name=web --format ' {{.Names}}\t{{.Image}}\t{{.Status}}'
echo
echo "The bot refuses to start without TOKEN_ENCRYPTION_KEY, so you will see a bootloop"
echo "Check with: docker logs bot --tail 40"
echo
echo "Check the web container's ADDRESS, not just that it started:"
echo "  ss -ltnp | grep 3000     # want 0.0.0.0:3000, not 127.0.1.1:3000"
