#!/usr/bin/env bash
# AlphaCapital Real-Time WebSocket Gateway Linux Launcher
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

if command -v pm2 >/dev/null 2>&1; then
  echo "Starting via PM2 process manager..."
  pm2 start ecosystem.config.js
  pm2 save
  pm2 status
else
  echo "PM2 not found, running directly with Node.js..."
  node index.js
fi
