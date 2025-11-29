#!/bin/bash

# Simple deploy script - automatically updates version and pushes
# Usage: ./deploy.sh "Your commit message"

echo "🚀 Budget Tracker - Auto Deploy Script"
echo "========================================"

# Update version
echo "📦 Updating version..."
node update-version.js

if [ $? -ne 0 ]; then
    echo "❌ Version update failed!"
    exit 1
fi

# Get the new version
NEW_VERSION=$(cat VERSION)
echo ""
echo "✅ Version updated to: v${NEW_VERSION}"
echo ""

# Add all changes
git add .

# Use custom message or default
if [ -z "$1" ]; then
    COMMIT_MSG="Deploy v${NEW_VERSION}"
else
    COMMIT_MSG="$1 (v${NEW_VERSION})"
fi

echo "📝 Committing: $COMMIT_MSG"
git commit -m "$COMMIT_MSG"

if [ $? -ne 0 ]; then
    echo "⚠️  Nothing to commit or commit failed"
    echo "Do you want to push anyway? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        exit 1
    fi
fi

# Push to origin
echo ""
echo "⬆️  Pushing to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "🎉 Successfully deployed v${NEW_VERSION}!"
    echo "🌐 GitHub Pages will update in ~1 minute"
    echo "========================================"
else
    echo ""
    echo "❌ Push failed! Please check your credentials"
    exit 1
fi

