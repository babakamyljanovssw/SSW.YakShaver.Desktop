import { Octokit } from "@octokit/rest";
import { app } from "electron";
import type { ProgressInfo, UpdateInfo } from "electron-updater";
import { autoUpdater } from "electron-updater";

export interface BranchInfo {
    name: string;
    displayName: string;
    sha: string;
    type: "release" | "branch" | "pr";
    prNumber?: number;
    releaseTag?: string;
}

export interface UpdaterConfig {
    owner: string;
    repo: string;
    channel?: string;
}

export class UpdaterService {
    private static instance: UpdaterService;
    private octokit: Octokit;
    private config: UpdaterConfig;
    private currentChannel: string = "latest";
    private branchesCache: { data: BranchInfo[]; timestamp: number } | null = null;
    private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
    private lastUpdateCheck: { channel: string; updateInfo: UpdateInfo | null } | null = null;

    private constructor() {
        this.config = {
            owner: "babakamyljanovssw",
            repo: "SSW.YakShaver.Desktop",
            channel: "latest",
        };

        // Initialize Octokit with optional authentication
        // If GITHUB_TOKEN is provided, use it for higher rate limits (5000/hour vs 60/hour)
        const githubToken = process.env.GITHUB_TOKEN;
        this.octokit = new Octokit({
            auth: githubToken,
        });

        if (githubToken) {
            console.log("GitHub token configured - higher rate limits available");
        } else {
            console.warn(
                "No GitHub token configured - using unauthenticated API (60 requests/hour limit). " +
                "Set GITHUB_TOKEN environment variable for higher limits.",
            );
        }

        // Configure autoUpdater
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;

        // Set up GitHub provider
        autoUpdater.setFeedURL({
            provider: "github",
            owner: this.config.owner,
            repo: this.config.repo,
        });
    }

    static getInstance(): UpdaterService {
        if (!UpdaterService.instance) {
            UpdaterService.instance = new UpdaterService();
        }
        return UpdaterService.instance;
    }

    /**
     * Get list of available branches/PRs to test
     * Uses caching to avoid hitting rate limits
     */
    async getAvailableBranches(forceRefresh: boolean = false): Promise<BranchInfo[]> {
        try {
            // Check cache first
            if (!forceRefresh && this.branchesCache) {
                const age = Date.now() - this.branchesCache.timestamp;
                if (age < this.CACHE_DURATION_MS) {
                    console.log(`Using cached branches list (age: ${Math.round(age / 1000)}s)`);
                    return this.branchesCache.data;
                }
            }

            console.log("Fetching branches from GitHub API...");
            const branches: BranchInfo[] = [];

            // Get latest stable release (optional - fork might not have one)
            try {
                const { data: latestRelease } = await this.octokit.repos.getLatestRelease({
                    owner: this.config.owner,
                    repo: this.config.repo,
                });

                branches.push({
                    name: latestRelease.tag_name,
                    displayName: `Latest Release (${latestRelease.tag_name})`,
                    sha: latestRelease.target_commitish,
                    type: "release",
                    releaseTag: latestRelease.tag_name,
                });

                // Set this as default current channel if we don't have one
                if (this.currentChannel === "latest" && latestRelease.tag_name) {
                    this.currentChannel = latestRelease.tag_name;
                }
            } catch (err) {
                console.warn("No stable releases found (this is normal for forks):", err);
            }

            // Get all releases including pre-releases (these are PR builds)
            const { data: releases } = await this.octokit.repos.listReleases({
                owner: this.config.owner,
                repo: this.config.repo,
                per_page: 50,
            });

            // Filter pre-releases that are PR builds (tagged as pr-<number>)
            for (const release of releases) {
                if (release.prerelease && release.tag_name.startsWith("pr-")) {
                    const prNumber = Number.parseInt(release.tag_name.split("-")[1], 10);
                    if (!Number.isNaN(prNumber)) {
                        branches.push({
                            name: release.tag_name,
                            displayName: `PR #${prNumber}: ${release.name || "Untitled"}`,
                            sha: release.target_commitish,
                            type: "pr",
                            prNumber,
                            releaseTag: release.tag_name,
                        });
                    }
                } else if (release.prerelease && release.tag_name.startsWith("branch-")) {
                    const branchName = release.tag_name.replace("branch-", "");
                    branches.push({
                        name: release.tag_name,
                        displayName: `Branch: ${branchName}`,
                        sha: release.target_commitish,
                        type: "branch",
                        releaseTag: release.tag_name,
                    });
                }
            }

            // Cache the results
            this.branchesCache = {
                data: branches,
                timestamp: Date.now(),
            };

            console.log(`Fetched ${branches.length} branches/PRs from GitHub`);
            return branches;
        } catch (error: any) {
            console.error("Failed to fetch branches:", error);

            // Check if it's a rate limit error
            if (error?.status === 403 && error?.message?.includes("rate limit")) {
                // Try to get rate limit info
                try {
                    const { data: rateLimit } = await this.octokit.rateLimit.get();
                    const resetDate = new Date(rateLimit.rate.reset * 1000);
                    const minutesUntilReset = Math.ceil((resetDate.getTime() - Date.now()) / 60000);

                    throw new Error(
                        `GitHub API rate limit exceeded. ` +
                        `Limit resets in ${minutesUntilReset} minutes. ` +
                        `${rateLimit.rate.remaining}/${rateLimit.rate.limit} requests remaining. ` +
                        `\n\nTo avoid this, set a GITHUB_TOKEN environment variable for higher limits (5000/hour).`,
                    );
                } catch (rateLimitError) {
                    // If we can't get rate limit info, return the cached data if available
                    if (this.branchesCache) {
                        console.warn("Rate limit hit, returning cached data");
                        return this.branchesCache.data;
                    }

                    throw new Error(
                        "GitHub API rate limit exceeded. Please wait a few minutes and try again. " +
                        "\n\nTip: Set a GITHUB_TOKEN environment variable for higher limits (5000/hour instead of 60/hour).",
                    );
                }
            }

            // Return cached data if available for other errors
            if (this.branchesCache) {
                console.warn("API error, returning cached data:", error.message);
                return this.branchesCache.data;
            }

            throw new Error(`Failed to fetch available branches: ${error.message || error}`);
        }
    }

    /**
     * Check for updates on the current channel
     */
    async checkForUpdates(channel: string = this.currentChannel): Promise<UpdateInfo | null> {
        try {
            this.currentChannel = channel;

            // For non-latest channels, we need to manually configure and check
            if (channel !== "latest") {
                const branches = await this.getAvailableBranches();
                const targetBranch = branches.find((b) => b.name === channel);

                if (!targetBranch || !targetBranch.releaseTag) {
                    throw new Error(`Channel ${channel} not found`);
                }

                // Get the specific release
                const { data: release } = await this.octokit.repos.getReleaseByTag({
                    owner: this.config.owner,
                    repo: this.config.repo,
                    tag: targetBranch.releaseTag,
                });

                // Check if this version is different from current
                const currentVersion = app.getVersion();
                if (release.tag_name !== `v${currentVersion}` && release.tag_name !== currentVersion) {
                    // Configure autoUpdater to point to this specific release
                    autoUpdater.setFeedURL({
                        provider: "github",
                        owner: this.config.owner,
                        repo: this.config.repo,
                        channel: release.tag_name,
                    });

                    // Force electron-updater to check this specific release
                    // This is required before downloadUpdate() can be called
                    try {
                        const checkResult = await autoUpdater.checkForUpdates();
                        console.log("Update check completed for channel:", channel);

                        // Store the update check result
                        this.lastUpdateCheck = {
                            channel,
                            updateInfo: checkResult?.updateInfo || {
                                version: release.tag_name,
                                releaseDate: release.published_at || new Date().toISOString(),
                                releaseName: release.name || release.tag_name,
                                releaseNotes: release.body || "",
                            } as UpdateInfo,
                        };
                    } catch (err) {
                        console.warn("autoUpdater check failed, but continuing:", err);
                        // Still store the update info even if check failed
                        this.lastUpdateCheck = {
                            channel,
                            updateInfo: {
                                version: release.tag_name,
                                releaseDate: release.published_at || new Date().toISOString(),
                                releaseName: release.name || release.tag_name,
                                releaseNotes: release.body || "",
                            } as UpdateInfo,
                        };
                    }

                    // Return the update info
                    return this.lastUpdateCheck.updateInfo;
                }

                this.lastUpdateCheck = { channel, updateInfo: null };
                return null;
            }

            // For latest channel, use standard autoUpdater
            autoUpdater.setFeedURL({
                provider: "github",
                owner: this.config.owner,
                repo: this.config.repo,
            });

            const result = await autoUpdater.checkForUpdates();
            this.lastUpdateCheck = {
                channel,
                updateInfo: result?.updateInfo || null,
            };
            return result?.updateInfo || null;
        } catch (error) {
            console.error("Failed to check for updates:", error);
            this.lastUpdateCheck = null;
            throw error;
        }
    }

    /**
     * Download the update for the specified channel
     * Automatically checks for updates first if not already done
     */
    async downloadUpdate(onProgress?: (progress: ProgressInfo) => void): Promise<void> {
        // Ensure we've checked for updates first
        // electron-updater requires checkForUpdates() to be called before downloadUpdate()
        if (!this.lastUpdateCheck || this.lastUpdateCheck.channel !== this.currentChannel) {
            console.log("Checking for updates before download...");
            try {
                await this.checkForUpdates(this.currentChannel);
            } catch (error) {
                throw new Error(`Failed to check for updates: ${error}`);
            }
        }

        // Verify we have an update available
        if (!this.lastUpdateCheck?.updateInfo) {
            throw new Error("No update available to download. Please check for updates first.");
        }

        // Ensure feed URL is configured
        if (this.currentChannel !== "latest") {
            const branches = await this.getAvailableBranches();
            const targetBranch = branches.find((b) => b.name === this.currentChannel);
            if (targetBranch?.releaseTag) {
                autoUpdater.setFeedURL({
                    provider: "github",
                    owner: this.config.owner,
                    repo: this.config.repo,
                    channel: targetBranch.releaseTag,
                });
            }
        }

        return new Promise((resolve, reject) => {
            if (onProgress) {
                autoUpdater.on("download-progress", onProgress);
            }

            autoUpdater.once("update-downloaded", () => {
                if (onProgress) {
                    autoUpdater.removeListener("download-progress", onProgress);
                }
                resolve();
            });

            autoUpdater.once("error", (error) => {
                if (onProgress) {
                    autoUpdater.removeListener("download-progress", onProgress);
                }
                reject(error);
            });

            // Now it's safe to download
            autoUpdater.downloadUpdate().catch(reject);
        });
    }

    /**
     * Install the downloaded update and restart the app
     */
    quitAndInstall(): void {
        autoUpdater.quitAndInstall(false, true);
    }

    /**
     * Switch to a different branch/PR channel
     */
    async switchChannel(channel: string): Promise<boolean> {
        try {
            this.currentChannel = channel;

            // Check if update is available
            const updateInfo = await this.checkForUpdates(channel);

            if (updateInfo) {
                return true; // Update available
            }

            return false; // Already on this version
        } catch (error) {
            console.error("Failed to switch channel:", error);
            throw error;
        }
    }

    /**
     * Get current app version
     */
    getCurrentVersion(): string {
        return app.getVersion();
    }

    /**
     * Get current channel
     */
    getCurrentChannel(): string {
        return this.currentChannel;
    }

    /**
     * Set up auto-update checking (for the current channel)
     */
    setupAutoUpdate(intervalMs: number = 60000 * 30): void {
        // Check every 30 minutes by default
        setInterval(async () => {
            try {
                await this.checkForUpdates();
            } catch (error) {
                console.error("Auto-update check failed:", error);
            }
        }, intervalMs);
    }

    /**
     * Clear the branches cache (useful for testing)
     */
    clearCache(): void {
        this.branchesCache = null;
        console.log("Branches cache cleared");
    }

    /**
     * Get GitHub API rate limit information
     */
    async getRateLimitInfo(): Promise<{
        limit: number;
        remaining: number;
        reset: Date;
        used: number;
    }> {
        try {
            const { data: rateLimit } = await this.octokit.rateLimit.get();
            return {
                limit: rateLimit.rate.limit,
                remaining: rateLimit.rate.remaining,
                reset: new Date(rateLimit.rate.reset * 1000),
                used: rateLimit.rate.used,
            };
        } catch (error) {
            console.error("Failed to get rate limit info:", error);
            throw error;
        }
    }
}
