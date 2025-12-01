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

  // File picker dialog - files only with multi-selection
  ipcMain.handle('dialog:openFiles', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: 'Select files to send',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths;
  });

  // Folder picker dialog - folders only
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
