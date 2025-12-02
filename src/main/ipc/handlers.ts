import { ipcMain, dialog, shell, clipboard, BrowserWindow } from 'electron';
import { checkDocker } from '../services/docker';
import { send, receive, decrypt } from '../services/wormhole';
import { cleanupTempDir } from '../utils/paths';
import {
  validateSendPaths,
  validateDecryptOutputDir,
  validateArchivePath,
  validateFolderPath,
  validatePassword,
  validateCode,
} from '../utils/validation';
import { ErrorCode, ProgressEvent } from '../../shared/types';

let mainWindow: BrowserWindow | null = null;

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
}

function emitProgress(event: ProgressEvent): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('wormhole:progress', event);
  }
}

function emitTransferComplete(type: 'send' | 'receive', success: boolean): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('wormhole:transfer-complete', { type, success });
  }
}

/**
 * Registers all IPC handlers.
 * Call this once before creating the BrowserWindow.
 */
export function registerIpcHandlers(): void {
  // Docker check
  ipcMain.handle('docker:check', async () => {
    return checkDocker();
  });

  // Send files (with optional encryption)
  ipcMain.handle('wormhole:send', async (_event, paths: string[], password?: string) => {
    // Validate paths
    const pathError = validateSendPaths(paths);
    if (pathError) {
      return {
        success: false,
        error: { code: ErrorCode.PATH_NOT_FOUND, message: pathError },
      };
    }

    // Validate password if provided
    const pwError = validatePassword(password);
    if (pwError) {
      return {
        success: false,
        error: { code: ErrorCode.INVALID_PASSWORD, message: pwError },
      };
    }

    return send(
      { paths, password },
      emitProgress,
      (success) => emitTransferComplete('send', success)
    );
  });

  // Receive file
  ipcMain.handle('wormhole:receive', async (_event, code: string) => {
    // Validate code
    const codeError = validateCode(code);
    if (codeError) {
      return {
        success: false,
        error: { code: ErrorCode.EMPTY_CODE, message: codeError },
      };
    }

    return receive({ code }, emitProgress);
  });

  // Decrypt received 7z archive
  ipcMain.handle('wormhole:decrypt', async (_event, archivePath: string, password: string, outputDir: string) => {
    // Validate archive path
    const archiveError = validateArchivePath(archivePath);
    if (archiveError) {
      return {
        success: false,
        error: { code: ErrorCode.PATH_NOT_FOUND, message: archiveError },
      };
    }

    // Validate output directory (must be within receive folder)
    const outputError = validateDecryptOutputDir(outputDir);
    if (outputError) {
      return {
        success: false,
        error: { code: ErrorCode.EXTRACT_FAILED, message: outputError },
      };
    }

    // Validate password
    if (typeof password !== 'string' || !password) {
      return {
        success: false,
        error: { code: ErrorCode.DECRYPT_FAILED, message: 'Password required' },
      };
    }

    return decrypt({ archivePath, password, outputDir });
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
    // Validate folder path
    const folderError = validateFolderPath(folderPath);
    if (folderError) {
      console.error('shell:openFolder validation failed:', folderError);
      return;
    }

    shell.showItemInFolder(folderPath);
  });

  // Copy to clipboard
  ipcMain.handle('clipboard:write', async (_event, text: string) => {
    clipboard.writeText(text);
  });

  // Cleanup temp files on startup
  cleanupTempDir();
}
