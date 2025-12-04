# GitHub Actions Workflows

## Auto Version Update

The `auto-version.yml` workflow automatically updates the app version on every push to main.

### How it works:
1. Triggers on push to main branch
2. Runs the `update-version.sh` script
3. Commits the version changes back to the repo
4. Uses `[skip ci]` flag to prevent infinite loops

### Version Format:
`YEAR.WEEK.DEPLOYMENT`
- Example: `25.49.4` = Year 2025, Week 49, 4th deployment

### Manual Override:
If you need to manually update the version:
```bash
bash update-version.sh
git add .
git commit -m "Your message"
git push
```

The action will be skipped if VERSION file is the only change.

