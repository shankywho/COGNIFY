#!/usr/bin/env bash
set -e

echo "🚀 Starting Cognify Local Development Environment..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
  echo "⚠️  Docker does not appear to be running. Please start Docker to run PostgreSQL & Redis."
else
  echo "📦 Starting PostgreSQL and Redis containers..."
  docker compose up -d postgres redis
fi

# Generate Prisma Client if not already generated
echo "🔄 Generating Prisma Client..."
npm run db:generate

# Start both client and server
echo "✨ Launching web and server development processes..."
npm run dev
