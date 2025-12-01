import { ipcMain, dialog, shell, clipboard } from 'electron';
import { checkDocker } from '../services/docker';
import { send, receive } from '../services/wormhole';
import { cleanupTempDir } from '../utils/paths';

/**
 * Registers all IPC handlers.
 * Call this once before creating the BrowserWindow.
 */
export function registerIpcHandlers(): void {
  // Docker check
  ipcMain.handle('docker:check', async () => {
    return checkDocker();
  });

  // Send files
  ipcMain.handle('wormhole:send', async (_event, paths: string[]) => {
    return send({ paths });
  });

  // Receive file
  ipcMain.handle('wormhole:receive', async (_event, code: string) => {
    return receive({ code });
  });

  // File picker dialog - files and folders with multi-selection
  ipcMain.handle('dialog:openFiles', async () => {
    // On Windows, openFile + openDirectory together doesn't work well
    // Use openFile with multiSelections, user can select folders too
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: 'Select files to send',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths;
  });

  // Folder picker dialog - separate handler for folders
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select folder to send',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths;
  });

  // Open folder in file explorer
  ipcMain.handle('shell:openFolder', async (_event, folderPath: string) => {
    shell.showItemInFolder(folderPath);
  });

  // Copy to clipboard
  ipcMain.handle('clipboard:write', async (_event, text: string) => {
    clipboard.writeText(text);
  });

  // Cleanup temp files on startup
  cleanupTempDir();
}
