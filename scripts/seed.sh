#!/usr/bin/env bash
set -e

echo "🌱 Running database seeds..."
cd server
npx ts-node ../database/seed.ts
echo "✅ Database seed completed."
