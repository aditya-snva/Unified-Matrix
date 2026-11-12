#!/usr/bin/env bash
# Pull the latest code and restart the backend.   Usage: bash deploy/update.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
git pull --ff-only
(cd backend && npm ci --omit=dev)
sudo systemctl restart unified-matrix
sleep 3
systemctl --no-pager --lines=15 status unified-matrix
