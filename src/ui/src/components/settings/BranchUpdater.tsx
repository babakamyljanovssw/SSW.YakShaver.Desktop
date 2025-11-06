import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ipcClient } from "@/services/ipc-client";

interface BranchInfo {
  name: string;
  displayName: string;
  sha: string;
  type: "release" | "branch" | "pr";
  prNumber?: number;
  releaseTag?: string;
}

interface DownloadProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export const BranchUpdater = () => {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [currentChannel, setCurrentChannel] = useState<string>("latest");
  const [selectedChannel, setSelectedChannel] = useState<string>("latest");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // Setup download progress listener
  useEffect(() => {
    const unsubscribe = ipcClient.updater.onDownloadProgress((progress) => {
      setDownloadProgress(progress);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      setRateLimitInfo(null);

      // Get current info
      const infoResult = await ipcClient.updater.getCurrentInfo();
      if (infoResult.success && infoResult.version && infoResult.channel) {
        setCurrentVersion(infoResult.version);
        setCurrentChannel(infoResult.channel);
        setSelectedChannel(infoResult.channel);
      }

      // Get available branches
      const branchesResult = await ipcClient.updater.getBranches();
      if (branchesResult.success && branchesResult.branches) {
        setBranches(branchesResult.branches);
      } else if (branchesResult.error) {
        const errorMsg = branchesResult.error;
        setError(errorMsg);

        // If it's a rate limit error, show helpful info
        if (errorMsg.includes("rate limit")) {
          setRateLimitInfo(
            "💡 Tip: The app is using GitHub's public API which is limited to 60 requests per hour. " +
              "To get 5,000 requests per hour, add a GITHUB_TOKEN to your .env file.",
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckForUpdates = async () => {
    try {
      setChecking(true);
      setError(null);

      const result = await ipcClient.updater.checkForUpdates(selectedChannel);

      if (result.success) {
        setUpdateAvailable(!!result.updateAvailable);
        setUpdateInfo(result.updateInfo);

        if (!result.updateAvailable) {
          alert("You are already on the latest version for this channel.");
        }
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check for updates");
    } finally {
      setChecking(false);
    }
  };

  const handleSwitchChannel = async () => {
    try {
      setChecking(true);
      setError(null);

      const result = await ipcClient.updater.switchChannel(selectedChannel);

      if (result.success) {
        setCurrentChannel(selectedChannel);
        setUpdateAvailable(!!result.updateAvailable);

        if (result.updateAvailable) {
          alert("Update available! Click 'Download Update' to download and install.");
        } else {
          alert("You are already on this version.");
        }
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch channel");
    } finally {
      setChecking(false);
    }
  };

  const handleDownloadUpdate = async () => {
    try {
      setDownloading(true);
      setError(null);
      setDownloadProgress(null);

      const result = await ipcClient.updater.downloadUpdate();

      if (result.success) {
        alert("Update downloaded successfully! Click 'Install & Restart' to apply the update.");
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download update");
    } finally {
      setDownloading(false);
    }
  };

  const handleInstallUpdate = async () => {
    try {
      const confirmed = confirm(
        "The app will restart to install the update. Make sure you've saved your work. Continue?",
      );

      if (!confirmed) return;

      setError(null);
      await ipcClient.updater.installUpdate();
      // App will restart, so no need to update state
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to install update");
    }
  };

  const getBranchBadgeVariant = (type: string) => {
    switch (type) {
      case "release":
        return "default";
      case "pr":
        return "secondary";
      case "branch":
        return "outline";
      default:
        return "default";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branch & Update Manager</CardTitle>
        <CardDescription>
          Test different branches and PRs before they're merged to main. Select a branch or PR to
          receive automatic updates when it changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Version Info */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div>
            <p className="text-sm font-medium">Current Version</p>
            <p className="text-xs text-muted-foreground">{currentVersion}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Current Channel</p>
            <Badge
              variant={getBranchBadgeVariant(
                branches.find((b) => b.name === currentChannel)?.type || "release",
              )}
            >
              {branches.find((b) => b.name === currentChannel)?.displayName || currentChannel}
            </Badge>
          </div>
        </div>

        {/* Branch Selection */}
        <div className="space-y-2">
          <label htmlFor="branch-select" className="text-sm font-medium">
            Select Branch or PR
          </label>
          <Select
            value={selectedChannel}
            onValueChange={setSelectedChannel}
            disabled={loading || checking || downloading}
          >
            <SelectTrigger id="branch-select">
              <SelectValue placeholder="Select a branch or PR" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.name} value={branch.name}>
                  <div className="flex items-center gap-2">
                    <Badge variant={getBranchBadgeVariant(branch.type)} className="text-xs">
                      {branch.type.toUpperCase()}
                    </Badge>
                    <span>{branch.displayName}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm space-y-2">
            <p className="font-medium">Error</p>
            <p className="whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {/* Rate Limit Info */}
        {rateLimitInfo && (
          <div className="p-3 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-lg text-sm">
            <p className="whitespace-pre-wrap">{rateLimitInfo}</p>
          </div>
        )}

        {/* Update Info */}
        {updateAvailable && updateInfo && (
          <div className="p-3 bg-primary/10 rounded-lg text-sm space-y-2">
            <p className="font-medium">Update Available</p>
            <p>
              <strong>Version:</strong> {updateInfo.version}
            </p>
            {updateInfo.releaseName && (
              <p>
                <strong>Release:</strong> {updateInfo.releaseName}
              </p>
            )}
            {updateInfo.releaseNotes && (
              <details className="mt-2">
                <summary className="cursor-pointer font-medium">Release Notes</summary>
                <div className="mt-2 p-2 bg-background rounded text-xs whitespace-pre-wrap">
                  {updateInfo.releaseNotes}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Download Progress */}
        {downloading && downloadProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Downloading...</span>
              <span>{Math.round(downloadProgress.percent)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {(downloadProgress.transferred / 1024 / 1024).toFixed(2)} MB /{" "}
              {(downloadProgress.total / 1024 / 1024).toFixed(2)} MB
              {" • "}
              {(downloadProgress.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={loadData}
            disabled={loading || checking || downloading}
            variant="outline"
            size="sm"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>

          {selectedChannel !== currentChannel && (
            <Button onClick={handleSwitchChannel} disabled={checking || downloading} size="sm">
              {checking ? "Switching..." : "Switch Channel"}
            </Button>
          )}

          <Button
            onClick={handleCheckForUpdates}
            disabled={checking || downloading}
            variant="secondary"
            size="sm"
          >
            {checking ? "Checking..." : "Check for Updates"}
          </Button>

          {updateAvailable && !downloading && (
            <Button onClick={handleDownloadUpdate} disabled={downloading} size="sm">
              Download Update
            </Button>
          )}

          {updateAvailable && !downloading && downloadProgress && (
            <Button onClick={handleInstallUpdate} variant="destructive" size="sm">
              Install & Restart
            </Button>
          )}
        </div>

        {/* Info Box */}
        <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground space-y-1">
          <p>
            <strong>💡 Tip:</strong> Select a PR to test changes before they're merged.
          </p>
          <p>
            When you switch to a PR or branch channel, you'll automatically receive updates when new
            commits are pushed.
          </p>
          <p>Switch back to "Latest Release" when you want to return to the stable version.</p>
        </div>
      </CardContent>
    </Card>
  );
};
