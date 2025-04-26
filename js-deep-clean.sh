#!/usr/bin/env bash
set -euo pipefail

echo "Removing node_modules directories..."
find . -type d -name "node_modules" -prune -exec rm -rf {} \;

echo "Removing dist directories..."
find . -type d -name "dist" -prune -exec rm -rf {} \;

echo "Removing .turbo directories..."
find . -type d -name ".turbo" -prune -exec rm -rf {} \;

echo "Removing .astro directories..."
find . -type d -name ".astro" -prune -exec rm -rf {} \;

echo "Removing .next directories..."
find . -type d -name ".next" -prune -exec rm -rf {} \;

echo "Removing tsconfig.buildinfo files..."
find . -type f -name "tsconfig.tsbuildinfo" -exec rm -f {} \;
find . -type f -name "tsconfig.build.tsbuildinfo" -exec rm -f {} \;

echo "Cleanup complete!"
