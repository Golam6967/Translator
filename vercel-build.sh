#!/bin/bash

# Vercel Build Script
# This script ensures all dependencies are ready for production deployment

echo "Starting Vercel build process..."

# Generate Prisma Client
echo "Generating Prisma Client..."
npx prisma generate

# Run Next.js build
echo "Building Next.js application..."
next build

echo "Build completed successfully!"
