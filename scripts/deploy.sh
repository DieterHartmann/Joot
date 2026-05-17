#!/usr/bin/env bash
set -euo pipefail

echo "Pulling latest code..."
git pull

echo "Building images..."
docker compose build api web worker

echo "Restarting services..."
docker compose up -d api web worker

echo "Done."
