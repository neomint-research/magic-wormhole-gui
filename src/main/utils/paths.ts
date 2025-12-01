import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { app } from 'electron';
import { TEMP_SUBDIR, RECEIVE_SUBDIR, ARCHIVE_PREFIX } from '../../shared/constants';

/**
 * Converts Windows path to Docker-compatible path.
 * C:\\Users\\Name\\file.txt -> /c/Users/Name/file.txt
 */
export function toDockerPath(windowsPath: string): string {
  if (os.platform() !== 'win32') {
    return windowsPath;
  }
  
  const normalized = windowsPath.replace(/\\/g, '/');
  const match = normalized.match(/^([a-zA-Z]):(.*)/);
  
  if (match) {
    return `/${match[1].toLowerCase()}${match[2]}`;
  }
  
  return normalized;
}

/**
 * Gets or creates the temp directory for archives.
 */
export function getTempDir(): string {
  const tempDir = path.join(app.getPath('temp'), TEMP_SUBDIR);
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  return tempDir;
}

/**
 * Gets or creates the receive directory.
 */
export function getReceiveDir(): string {
  const receiveDir = path.join(app.getPath('documents'), RECEIVE_SUBDIR);
  
  if (!fs.existsSync(receiveDir)) {
    fs.mkdirSync(receiveDir, { recursive: true });
  }
  
  return receiveDir;
}

/**
 * Generates unique archive filename.
 */
export function generateArchiveName(): string {
  const timestamp = Date.now();
  return `${ARCHIVE_PREFIX}${timestamp}.zip`;
}

/**
 * Creates a unique subdirectory for a receive operation.
 */
export function createReceiveSubdir(): string {
  const receiveDir = getReceiveDir();
  const subdir = path.join(receiveDir, `receive-${Date.now()}`);
  fs.mkdirSync(subdir, { recursive: true });
  return subdir;
}

/**
 * Cleans up old temp files (older than 1 hour).
 */
export function cleanupTempDir(): void {
  const tempDir = getTempDir();
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  
  try {
    const files = fs.readdirSync(tempDir);
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtimeMs < oneHourAgo) {
        fs.unlinkSync(filePath);
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Gets the first file in a directory (for receive result).
 * Waits briefly for filesystem sync before reading.
 */
export function getFirstFileInDir(dir: string): string | null {
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        return filePath;
      }
    }
  } catch {
    // Ignore errors
  }
  
  return null;
}
