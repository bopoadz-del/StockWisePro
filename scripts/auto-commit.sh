#!/bin/bash

# Auto Commit and Push Script
# Usage: ./scripts/auto-commit.sh [optional commit message]

cd "$(dirname "$0")/.."

# Check if there are changes to commit
if git diff --quiet && git diff --staged --quiet; then
    echo "✅ No changes to commit."
    exit 0
fi

# Get the current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Generate commit message
if [ -n "$1" ]; then
    # Use provided message
    COMMIT_MSG="$1"
else
    # Auto-generate message with timestamp
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    CHANGES=$(git diff --name-only | head -5 | tr '\n' ', ')
    if [ -z "$CHANGES" ]; then
        CHANGES=$(git diff --staged --name-only | head -5 | tr '\n' ', ')
    fi
    COMMIT_MSG="auto: update at $TIMESTAMP - ${CHANGES%, }"
fi

# Add all changes
echo "📦 Adding changes..."
git add -A

# Commit
echo "💾 Committing: $COMMIT_MSG"
git commit -m "$COMMIT_MSG"

# Push
echo "🚀 Pushing to $BRANCH..."
git push origin "$BRANCH"

echo "✅ Done! Committed and pushed to $BRANCH"
