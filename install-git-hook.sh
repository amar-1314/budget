#!/bin/bash

# Install git pre-push hook that auto-updates version
# Run once: ./install-git-hook.sh

echo "🔧 Installing Git Pre-Push Hook..."

# Create the hook
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash

# Pre-push hook - Auto-update version before pushing to main
# This runs automatically when you do: git push

# Check if pushing to main branch
if [[ "$1" == *"origin"* ]]; then
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    
    if [ "$current_branch" = "main" ] || [ "$current_branch" = "old-design" ]; then
        echo "🔄 Auto-updating version before push..."
        
        # Run version update
        node update-version.js
        
        if [ $? -eq 0 ]; then
            # Stage the version changes
            git add VERSION script.js service-worker.js
            
            # Get new version
            NEW_VERSION=$(cat VERSION)
            
            # Amend the last commit with version changes
            git commit --amend --no-edit --no-verify
            
            echo "✅ Version auto-updated to v${NEW_VERSION}"
        else
            echo "⚠️  Version update failed, pushing anyway..."
        fi
    fi
fi

exit 0
EOF

# Make it executable
chmod +x .git/hooks/pre-push

echo "✅ Git hook installed successfully!"
echo ""
echo "Now whenever you run 'git push', version will auto-update!"
echo ""
echo "Test it:"
echo "  git add ."
echo "  git commit -m 'test'"
echo "  git push"

