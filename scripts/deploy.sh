#!/usr/bin/env bash
set -euo pipefail

echo "Pulling latest code..."
git pull

echo "Building images..."
docker compose build api web worker

echo "Restarting services..."
docker compose up -d

echo "Reloading nginx upstream..."
# nginx caches container IPs at startup. After any app container restarts it gets
# a new IP; reloading nginx forces it to re-resolve Docker DNS for all upstreams.
docker compose exec nginx nginx -s reload

echo "Done."
