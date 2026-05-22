#!/bin/bash

# Set working directory to the script's folder
cd "$(dirname "$0")"

echo "=========================================="
echo "   MagnetFinder - Initializing..."
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "[ERROR] Node.js is not installed!"
    echo "Please install it from https://nodejs.org/"
    read -p "Press Enter to exit..."
    exit
fi

# Install dependencies if necessary
if [ ! -d "node_modules" ]; then
    echo "[INFO] First time use: Installing components..."
    npm install --production
fi

echo "[OK] Launching application..."
echo ""
node start.js
