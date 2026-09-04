#!/bin/sh
#
# Pull an image and restart both containers from it.
#
# ---------------------------------------------------------------------------------
# RECONSTRUCTED, NOT COPIED. The authoritative version of this script has only ever
# existed on the droplet, which is the problem this file exists to fix. This was
# rebuilt from what the running deployment was observed to do, so before trusting it:
#
#     diff /path/to/redeploy.sh redeploy.sh     # on the droplet
#
# and reconcile any difference in favour of whatever is actually working. Once they
# match, the droplet copy can be replaced by this one and the repository becomes the
# source of truth.
# ---------------------------------------------------------------------------------
#
# Usage:
#     ./redeploy.sh              # latest
#     ./redeploy.sh 4.4.0        # a specific version
#     ./redeploy.sh a1b2c3d      # a specific commit
#
# CI publishes three tags for every build - :latest, :<package version> and :<sha> -
# so a rollback is `./redeploy.sh <the previous version>`. The old script hard-coded
# :latest, which meant those tags were published and never usable: there was no
# earlier image to go back to, only the newest one under a different name.
#
# /bin/sh, not bash: the droplet's sh is dash, which has no `set -o pipefail`.
set -eu

IMAGE_NAME="nexusmods/discord-bot"
TAG="${1:-latest}"
IMAGE="${IMAGE_NAME}:${TAG}"

# Both containers mount the same .env, from whatever directory this is run in, so one
# file configures both and they cannot drift to different settings.
ENV_FILE="$PWD/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "No .env found at $ENV_FILE - run this from the directory that holds it." >&2
    exit 1
fi

echo "Pulling $IMAGE"
docker pull "$IMAGE"

# Removed rather than stopped: `docker run` fails on a name that already exists, and a
# stopped-but-present container would take the name and leave the old code in place.
for c in bot web; do
    docker rm -f "$c" >/dev/null 2>&1 || true
done

# --network host, so there are no port mappings to publish. The web process binds
# AUTH_PORT directly on the host. DEPLOYING.md described moving a published port for a
# while, which does not apply to this deployment and never did.
echo "Starting bot"
docker run -d --name bot --restart unless-stopped --network host \
    -v "$ENV_FILE:/app/.env" "$IMAGE" node dist/shards.js

echo "Starting web"
docker run -d --name web --restart unless-stopped --network host \
    -v "$ENV_FILE:/app/.env" "$IMAGE" node dist/web.js

docker image prune -f

echo
echo "Deployed $IMAGE. Both containers should be up:"
docker ps --filter name=bot --filter name=web --format '  {{.Names}}\t{{.Image}}\t{{.Status}}'
echo
echo "The bot refuses to start without TOKEN_ENCRYPTION_KEY, so a restart loop here"
echo "usually means .env is missing it. Check with: docker logs bot --tail 40"
