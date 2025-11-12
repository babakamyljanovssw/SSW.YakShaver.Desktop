import { ipcMain } from "electron";
import type { ProgressInfo } from "electron-updater";
import { UpdaterService } from "../services/updater/updater-service";
import { IPC_CHANNELS } from "./channels";

export class UpdaterIPCHandlers {
  private updaterService: UpdaterService;

  constructor() {
    this.updaterService = UpdaterService.getInstance();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Get available branches/PRs
    ipcMain.handle(IPC_CHANNELS.UPDATER_GET_BRANCHES, async () => {
      try {
        const branches = await this.updaterService.getAvailableBranches();
        return { success: true, branches };
      } catch (error) {
        console.error("Failed to get branches:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    // Get current version and channel
    ipcMain.handle(IPC_CHANNELS.UPDATER_GET_CURRENT_INFO, async () => {
      try {
        return {
          success: true,
          version: this.updaterService.getCurrentVersion(),
          channel: this.updaterService.getCurrentChannel(),
        };
      } catch (error) {
        console.error("Failed to get current info:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    // Check for updates
    ipcMain.handle(IPC_CHANNELS.UPDATER_CHECK_FOR_UPDATES, async (_event, channel?: string) => {
      try {
        const updateInfo = await this.updaterService.checkForUpdates(channel);
        return {
          success: true,
          updateAvailable: !!updateInfo,
          updateInfo,
        };
      } catch (error) {
        console.error("Failed to check for updates:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    // Download update
    ipcMain.handle(IPC_CHANNELS.UPDATER_DOWNLOAD_UPDATE, async (event) => {
      try {
        await this.updaterService.downloadUpdate((progress: ProgressInfo) => {
          // Send progress updates to renderer
          event.sender.send(IPC_CHANNELS.UPDATER_DOWNLOAD_PROGRESS, progress);
        });
        return { success: true };
      } catch (error) {
        console.error("Failed to download update:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    // Install update and restart
    ipcMain.handle(IPC_CHANNELS.UPDATER_INSTALL_UPDATE, async () => {
      try {
        this.updaterService.quitAndInstall();
        return { success: true };
      } catch (error) {
        console.error("Failed to install update:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    // Switch channel (branch/PR)
    ipcMain.handle(IPC_CHANNELS.UPDATER_SWITCH_CHANNEL, async (_event, channel: string) => {
      try {
        const updateAvailable = await this.updaterService.switchChannel(channel);
        return {
          success: true,
          updateAvailable,
        };
      } catch (error) {
        console.error("Failed to switch channel:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });
  }
}
