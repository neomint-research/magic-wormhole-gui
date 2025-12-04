import { ipcMain, dialog, shell, clipboard, BrowserWindow, app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { checkDocker } from '../services/docker';
import { send, receive, decrypt } from '../services/wormhole';
import { cleanupTempDir, getTempDir } from '../utils/paths';
import { secureDelete } from '../utils/secure-delete';
import {
  validateSendPaths,
  validateDecryptOutputDir,
  validateArchivePath,
  validateFolderPath,
  validatePassword,
  validateCode,
} from '../utils/validation';
import { ErrorCode, ProgressEvent, TextPrepareResponse, TextReadResponse, SecureDeleteRequest, SecureDeleteResponse, Result } from '../../shared/types';
import { TEXT_MESSAGE_FILENAME, TEXT_MAX_LENGTH } from '../../shared/constants';

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

  // ============================================================
  // TEXT MESSAGE HANDLERS
  // ============================================================

  // Prepare text message: write to temp file for sending
  ipcMain.handle('text:prepare', async (_event, text: string): Promise<Result<TextPrepareResponse>> => {
    // Validate input
    if (typeof text !== 'string') {
      return {
        success: false,
        error: { code: ErrorCode.EMPTY_PATHS, message: 'Invalid text input' },
      };
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return {
        success: false,
        error: { code: ErrorCode.EMPTY_PATHS, message: 'Text message cannot be empty' },
      };
    }

    if (trimmedText.length > TEXT_MAX_LENGTH) {
      return {
        success: false,
        error: { code: ErrorCode.ARCHIVE_TOO_LARGE, message: `Text exceeds maximum length of ${TEXT_MAX_LENGTH} characters` },
      };
    }

    try {
      const tempDir = getTempDir();
      const filePath = path.join(tempDir, TEXT_MESSAGE_FILENAME);
      fs.writeFileSync(filePath, trimmedText, 'utf-8');
      return { success: true, data: { filePath } };
    } catch (err) {
      return {
        success: false,
        error: { code: ErrorCode.TEMP_DIR_FAILED, message: 'Failed to prepare text message' },
      };
    }
  });

  // Read text message: check if received file is a text message
  ipcMain.handle('text:read', async (_event, filePath: string): Promise<Result<TextReadResponse>> => {
    try {
      // Validate path exists
      if (!filePath || typeof filePath !== 'string') {
        return { success: true, data: { wasTextMessage: false } };
      }

      const fileName = path.basename(filePath);

      // Check if it's a text message by filename convention
      if (fileName !== TEXT_MESSAGE_FILENAME) {
        return { success: true, data: { wasTextMessage: false } };
      }

      // Verify file exists
      if (!fs.existsSync(filePath)) {
        return { success: true, data: { wasTextMessage: false } };
      }

      // Read content
      const content = fs.readFileSync(filePath, 'utf-8');

      // Delete file (no persistence for text messages)
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Ignore deletion errors
      }

      return { success: true, data: { wasTextMessage: true, content } };
    } catch (err) {
      return {
        success: false,
        error: { code: ErrorCode.PATH_NOT_READABLE, message: 'Failed to read text message' },
      };
    }
  });

  // ============================================================
  // SECURE DELETE HANDLERS
  // ============================================================

  // Securely delete files (overwrite with random data before unlinking)
  ipcMain.handle('secure:delete', async (_event, request: SecureDeleteRequest): Promise<Result<SecureDeleteResponse>> => {
    // Type validation - IPC can receive anything
    if (!request || typeof request !== 'object') {
      return {
        success: false,
        error: {
          code: ErrorCode.SECURE_DELETE_FAILED,
          message: 'Invalid request',
        },
      };
    }

    const { tempPaths, originalPaths } = request;

    // Validate arrays if provided
    if (tempPaths !== undefined && !Array.isArray(tempPaths)) {
      return {
        success: false,
        error: {
          code: ErrorCode.SECURE_DELETE_FAILED,
          message: 'tempPaths must be an array',
        },
      };
    }
    if (originalPaths !== undefined && !Array.isArray(originalPaths)) {
      return {
        success: false,
        error: {
          code: ErrorCode.SECURE_DELETE_FAILED,
          message: 'originalPaths must be an array',
        },
      };
    }

    // Validate that at least one path array is provided
    const hasTempPaths = tempPaths && tempPaths.length > 0;
    const hasOriginalPaths = originalPaths && originalPaths.length > 0;

    if (!hasTempPaths && !hasOriginalPaths) {
      return {
        success: true,
        data: { deletedCount: 0 },
      };
    }

    // Validate temp paths - must be within temp directory
    if (hasTempPaths) {
      const tempDir = path.normalize(getTempDir()).toLowerCase();
      for (const p of tempPaths!) {
        // Type check
        if (typeof p !== 'string') {
          return {
            success: false,
            error: {
              code: ErrorCode.SECURE_DELETE_FAILED,
              message: 'Path must be a string',
            },
          };
        }
        // Block null bytes (security risk)
        if (p.includes('\0')) {
          return {
            success: false,
            error: {
              code: ErrorCode.SECURE_DELETE_FAILED,
              message: 'Invalid path - null bytes not allowed',
            },
          };
        }
        const resolved = path.normalize(path.resolve(p)).toLowerCase();
        if (!resolved.startsWith(tempDir)) {
          return {
            success: false,
            error: {
              code: ErrorCode.SECURE_DELETE_FAILED,
              message: 'Invalid temp path - outside temp directory',
              details: p,
            },
          };
        }
      }
    }

    // Validate original paths - must exist and not contain path traversal
    if (hasOriginalPaths) {
      for (const p of originalPaths!) {
        // Type check
        if (typeof p !== 'string') {
          return {
            success: false,
            error: {
              code: ErrorCode.SECURE_DELETE_FAILED,
              message: 'Path must be a string',
            },
          };
        }
        // Block null bytes (security risk)
        if (p.includes('\0')) {
          return {
            success: false,
            error: {
              code: ErrorCode.SECURE_DELETE_FAILED,
              message: 'Invalid path - null bytes not allowed',
            },
          };
        }
        // Block path traversal
        if (p.includes('..')) {
          return {
            success: false,
            error: {
              code: ErrorCode.SECURE_DELETE_FAILED,
              message: 'Invalid path - path traversal not allowed',
              details: p,
            },
          };
        }
        // Must be absolute path
        if (!path.isAbsolute(p)) {
          return {
            success: false,
            error: {
              code: ErrorCode.SECURE_DELETE_FAILED,
              message: 'Invalid path - must be absolute',
              details: p,
            },
          };
        }
      }
    }

    // Perform secure deletion
    return secureDelete(tempPaths, originalPaths);
  });
}
