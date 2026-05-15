#!/usr/bin/env bash
set -euo pipefail

echo "Pulling latest code..."
git pull

echo "Building images..."
docker compose build api web

echo "Restarting services..."
docker compose up -d api web

echo "Done."
