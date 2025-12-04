#!/bin/bash

# Auto-update version following format: YEAR.WEEK.DEPLOYMENT
# Example: 25.48.1 (2025, Week 48, 1st deployment)
# Run this before deployment: ./update-version.sh

# Calculate ISO week number
get_week_number() {
    date -u +"%V"
}

echo "🚀 Budget Tracker Version Update"
echo "=================================================="

# Get current values
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
YEAR=$(date -u +"%y")
WEEK=$(get_week_number)

# Read current version
if [ -f VERSION ]; then
    CURRENT_VERSION=$(cat VERSION)
    IFS='.' read -r CURRENT_YEAR CURRENT_WEEK CURRENT_DEPLOY <<< "$CURRENT_VERSION"
else
    CURRENT_YEAR=0
    CURRENT_WEEK=0
    CURRENT_DEPLOY=0
fi

# Calculate new deployment number
if [ "$CURRENT_YEAR" = "$YEAR" ] && [ "$CURRENT_WEEK" = "$WEEK" ]; then
    # Same week - increment deployment
    NEW_DEPLOY=$((CURRENT_DEPLOY + 1))
else
    # New week - reset to 1
    NEW_DEPLOY=1
fi

VERSION="${YEAR}.${WEEK}.${NEW_DEPLOY}"

echo "📅 Current Week: Week $WEEK, 20$YEAR"
echo "🔢 Deployment #$NEW_DEPLOY this week"
echo "📦 New Version: v$VERSION"
echo "🕐 Build Time: $TIMESTAMP"
echo ""

# Update VERSION file
echo "$VERSION" > VERSION
echo "✅ Updated VERSION file"

# Update script.js - both BUILD_TIMESTAMP and APP_VERSION
sed -i.bak "s/const BUILD_TIMESTAMP = '[^']*';/const BUILD_TIMESTAMP = '$TIMESTAMP';/" script.js && \
sed -i.bak "s/const APP_VERSION = '[^']*';/const APP_VERSION = '$VERSION';/" script.js && \
rm script.js.bak 2>/dev/null && \
echo "✅ Updated script.js"

# Update service-worker.js
sed -i.bak "s/const BUILD_TIMESTAMP = '[^']*';/const BUILD_TIMESTAMP = '$TIMESTAMP';/" service-worker.js && \
rm service-worker.js.bak 2>/dev/null && \
echo "✅ Updated service-worker.js"

# Update index.html - cache-busting query parameters
sed -i.bak "s/script\.js?v=[0-9.]\+/script.js?v=$VERSION/" index.html && \
sed -i.bak "s/style\.css?v=[0-9.]\+/style.css?v=$VERSION/" index.html && \
rm index.html.bak 2>/dev/null && \
echo "✅ Updated index.html cache-busting parameters"

echo ""
echo "=================================================="
echo "🎉 Version updated to: v$VERSION"
echo "✨ Ready to commit and deploy!"
echo ""
echo "Next steps:"
echo "  git add ."
echo "  git commit -m \"Deploy v$VERSION\""
echo "  git push origin main"
echo "=================================================="

