# Branch Testing Guide

This guide explains how to use the new branch-based testing feature in YakShaver Desktop.

## Overview

The branch testing feature allows you to:
- Test pull requests before they're merged to main
- Switch between different development branches
- Automatically receive updates when PRs/branches are updated
- Easily switch back to stable releases

## How It Works

### 1. Automated Builds

When you create a pull request or push to a branch, GitHub Actions automatically:
- Builds the app for Windows and macOS
- Creates a pre-release tagged as `pr-<number>` or `branch-<name>`
- Publishes the build artifacts to GitHub Releases

### 2. Branch Selection in App

The app includes a **Branch & Update Manager** in Settings that lets you:
- View all available branches and PRs
- Switch to a specific PR or branch
- Check for updates
- Download and install updates

### 3. Automatic Updates

Once you switch to a PR/branch channel:
- The app checks for updates every 30 minutes
- When new commits are pushed to that PR/branch, a new build is created
- You'll be notified when an update is available
- You can download and install the update with one click

## Using the Feature

### Accessing the Branch Manager

1. Open the YakShaver app
2. Click the **Settings** button in the top-right corner
3. Select **Branch & Updates** from the sidebar

### Testing a Pull Request

1. Open the Branch & Update Manager in Settings
2. Click "Refresh" to load the latest available branches/PRs
3. Select the PR you want to test from the dropdown (e.g., "PR #123: Add new feature")
4. Click **Switch Channel**
5. If an update is available, click **Download Update**
6. Once downloaded, click **Install & Restart**
7. The app will restart with the PR's code

### Returning to Stable Release

1. Open the Branch & Update Manager
2. Select "Latest Release" from the dropdown
3. Click **Switch Channel**
4. Download and install the update
5. Restart the app

### Testing a Development Branch

Same process as testing a PR, but select a branch like "Branch: feature/new-feature"

## For Developers

### Workflow Files

Two new GitHub workflows have been added:

1. **`.github/workflows/build-pr.yml`** - Builds and publishes PRs and branches as pre-releases
2. **`.github/workflows/release-electron-app.yml`** - Still used for stable releases (unchanged)

### How Builds Are Tagged

- **Stable releases**: Tagged as `v1.0.0`, `v1.1.0`, etc.
- **PR builds**: Tagged as `pr-123` (where 123 is the PR number)
- **Branch builds**: Tagged as `branch-feature-name` (with `/` replaced by `-`)

### Backend Implementation

The implementation consists of:

1. **UpdaterService** (`src/backend/services/updater/updater-service.ts`)
   - Manages electron-updater configuration
   - Fetches available branches/PRs from GitHub API
   - Handles update checking, downloading, and installation

2. **UpdaterIPCHandlers** (`src/backend/ipc/updater-handlers.ts`)
   - Exposes updater functionality to the renderer process
   - Handles IPC communication between backend and UI

3. **IPC Channels** (`src/backend/ipc/channels.ts`, `src/backend/preload.ts`)
   - Defines secure communication channels
   - Exposes updater API to the UI

### UI Implementation

1. **BranchUpdater Component** (`src/ui/src/components/settings/BranchUpdater.tsx`)
   - Main UI for branch/PR selection
   - Displays current version and channel
   - Shows download progress
   - Handles update installation

2. **SettingsPanel Component** (`src/ui/src/components/settings/SettingsPanel.tsx`)
   - Settings modal with tabs
   - Includes Branch & Update Manager
   - Also includes other settings (LLM, MCP, Custom Prompts)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Actions                        │
│  • Build PR/branch on push                              │
│  • Create pre-release with artifacts                    │
│  • Tag as pr-<number> or branch-<name>                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  GitHub Releases API                     │
│  • Lists all releases (stable + pre-releases)           │
│  • Provides download URLs for artifacts                 │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│             electron-updater (Backend)                   │
│  • Checks for updates on selected channel               │
│  • Downloads update artifacts                           │
│  • Applies updates on restart                           │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              UI (Branch Manager)                         │
│  • Displays available branches/PRs                      │
│  • Allows channel switching                             │
│  • Shows download progress                              │
│  • Triggers update installation                         │
└─────────────────────────────────────────────────────────┘
```

## Configuration

### electron-updater Configuration

The updater is configured in `src/backend/services/updater/updater-service.ts`:

```typescript
autoUpdater.setFeedURL({
  provider: "github",
  owner: "SSWConsulting",
  repo: "SSW.YakShaver.Desktop",
});
```

### Auto-Update Interval

By default, the app checks for updates every 30 minutes when a channel is selected:

```typescript
UpdaterService.getInstance().setupAutoUpdate(1000 * 60 * 30);
```

## Troubleshooting

### "GitHub API rate limit exceeded"

**Quick Fix**: Add a GitHub token to your `.env` file for 5,000 requests/hour instead of 60.

See [GITHUB_TOKEN_SETUP.md](./GITHUB_TOKEN_SETUP.md) for a 5-minute setup guide.

**Temporary workaround**: 
- Wait a few minutes (branches are cached for 5 minutes)
- Close and reopen settings (uses cached data if available)
- Wait for rate limit to reset (shown in error message)

### "Failed to fetch branches"

- Check your internet connection
- Verify the GitHub repository is accessible
- See above for rate limit issues

### "No update available"

- Ensure the PR/branch has been built successfully
- Check GitHub Actions to see if the build completed
- Refresh the branch list

### Download fails

- Check available disk space
- Verify network connection
- Try downloading again

### App doesn't restart after update

- Manually restart the app
- Check if antivirus is blocking the installer

## Security Considerations

1. **Pre-releases are unsigned** - They may trigger security warnings
2. **Use in development only** - Branch testing is meant for development/testing
3. **Stable releases are signed** - Production builds go through the normal release process
4. **No automatic installation** - Updates must be manually approved

## Benefits

✅ **Faster feedback loop** - Test changes immediately without merging  
✅ **Parallel testing** - Multiple team members can test different PRs  
✅ **Easy rollback** - Switch back to stable with one click  
✅ **Automatic updates** - Get the latest changes when PR is updated  
✅ **No local builds needed** - CI/CD handles all building  

## Limitations

⚠️ **Build time** - GitHub Actions takes ~10-15 minutes per build  
⚠️ **Storage** - Artifacts are stored for 30 days by default  
⚠️ **Unsigned builds** - Pre-release builds are not code-signed  
⚠️ **Windows only on PR** - macOS builds may require additional setup for code signing  

## Future Enhancements

- [ ] Add notifications when updates are available
- [ ] Show build status (in progress, failed, completed)
- [ ] Add ability to pin specific commits
- [ ] Support for alpha/beta channels
- [ ] Automatic rollback on crash

