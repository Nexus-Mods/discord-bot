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

if ! grep -q '^DBPORT=' "$ENV_FILE"; then
    echo "DBPORT is not set in $ENV_FILE." >&2
    exit 1
fi

echo "Pulling $BOT_IMAGE"
docker pull "$BOT_IMAGE"
echo "Pulling $WEB_IMAGE"
docker pull "$WEB_IMAGE"

for c in bot web; do docker rm -f "$c" >/dev/null 2>&1 || true; done

echo "Starting bot"

docker run -d --name bot --restart unless-stopped --network host -v "$ENV_FILE:/app/.env" "$BOT_IMAGE" node dist/shard.js

echo "Starting web"
docker run -d --name web --restart unless-stopped --network host -v "$ENV_FILE:/app/.env" -e PORT=3000 node server.js

docker image prune -f

echo
echo "Deployed $TAG. Both containers should be up:"
docker ps --filter name=bot --filter name=web --format ' {{.Names}}\t{{.Image}}\t{{.Status}}'
echo
echo "The bot refuses to start without TOKEN_ENCRYPTION_KEY, so you will see a bootloop"
echo "Check with: docker logs bot --tail 40"

