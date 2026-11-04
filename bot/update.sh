#!/usr/bin/env bash
set -e
echo "Updating Nexus EMS Bot..."
npm install
npm run build
echo "Starting bot..."
npm start
