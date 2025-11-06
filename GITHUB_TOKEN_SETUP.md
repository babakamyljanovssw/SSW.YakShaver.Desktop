# GitHub Token Setup Guide

## Why You Need a GitHub Token

The Branch & Update Manager uses GitHub's API to fetch available branches and PRs. Without authentication, GitHub limits you to **60 requests per hour**. With a token, you get **5,000 requests per hour**.

## Quick Setup (5 minutes)

### 1. Create a GitHub Personal Access Token

1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → [Tokens (classic)](https://github.com/settings/tokens)
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a name: `YakShaver Branch Manager`
4. **No scopes needed** - Just leave everything unchecked (we only need public repository access)
5. Click **"Generate token"**
6. **Copy the token** (you won't see it again!)

### 2. Add Token to Your .env File

1. Open your project's `.env` file (in the root directory)
2. Add this line:
   ```
   GITHUB_TOKEN=your_token_here
   ```
3. Replace `your_token_here` with the token you copied
4. Save the file

### 3. Restart the App

The token is loaded when the app starts, so restart it to apply the change.

## Example .env File

```env
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Verifying It Works

When you restart the app, check the console/logs for:
- ✅ `"GitHub token configured - higher rate limits available"`
- ❌ `"No GitHub token configured - using unauthenticated API"`

## Security Notes

### Is This Safe?

✅ **Yes** - The token needs NO permissions (scopes) to read public repositories  
✅ **Local only** - The token stays on your machine, never sent anywhere except GitHub  
✅ **Read-only** - Can only read public data, cannot modify anything  
✅ **Revocable** - You can delete it anytime on GitHub  

### Best Practices

1. **Use a token with no scopes** - Safer if accidentally exposed
2. **Don't commit .env** - Already in .gitignore
3. **Generate a dedicated token** - Easier to track and revoke
4. **Rotate regularly** - Generate a new one every few months

## Troubleshooting

### "No GitHub token configured" message still appears

- Make sure the `.env` file is in the root directory (same as `package.json`)
- Check the line format: `GITHUB_TOKEN=your_token` (no spaces around `=`)
- Restart the app completely
- Check the token is still valid on GitHub

### Token not working

- Verify the token on GitHub.com → Settings → Developer settings → Tokens
- Make sure it hasn't expired
- Generate a new one if needed

### Still getting rate limit errors

- Wait for the rate limit to reset (usually within an hour)
- The app caches branch data for 5 minutes to reduce API calls
- Check if you're running multiple instances of the app

## Alternative: Using GitHub CLI Token

If you already have GitHub CLI installed and authenticated:

```bash
# Get your token from GitHub CLI
gh auth token
```

Copy the output and add it to your `.env` file.

## Rate Limit Information

| Authentication | Requests per Hour | Good For |
|---------------|-------------------|----------|
| None | 60 | Testing, light use |
| Token | 5,000 | Development, frequent updates |

With caching, you should rarely hit limits even without a token, but having one eliminates the concern.

## For CI/CD

For automated builds, you can set the token as an environment variable:

### Windows
```powershell
$env:GITHUB_TOKEN="your_token"
```

### macOS/Linux
```bash
export GITHUB_TOKEN="your_token"
```

### GitHub Actions
Already handled - GitHub provides `GITHUB_TOKEN` automatically in workflows.

## Need Help?

If you're still having issues:
1. Check the app's console/logs for specific errors
2. Verify your token at https://github.com/settings/tokens
3. Try generating a fresh token
4. Check GitHub's API status: https://www.githubstatus.com/

