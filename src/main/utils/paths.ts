import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { app } from 'electron';
import { TEMP_SUBDIR, RECEIVE_SUBDIR, ARCHIVE_PREFIX, CLEANUP_MAX_AGE_MS } from '../../shared/constants';

/**
 * Detects if running in portable mode.
 * Portable mode is indicated by a .portable marker file in the app directory.
 */
export function isPortableMode(): boolean {
  const portableMarker = path.join(path.dirname(app.getPath('exe')), '.portable');
  return fs.existsSync(portableMarker);
}

/**
 * Gets the portable data directory path.
 */
export function getPortableDataDir(): string {
  return path.join(path.dirname(app.getPath('exe')), 'data');
}

/**
 * Gets the base data directory (portable-aware).
 */
function getDataDir(): string {
  if (isPortableMode()) {
    return getPortableDataDir();
  }
  return app.getPath('userData');
}

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
 * In portable mode, uses local data directory.
 */
export function getTempDir(): string {
  const baseDir = isPortableMode() ? getDataDir() : app.getPath('temp');
  const tempDir = path.join(baseDir, TEMP_SUBDIR);
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  return tempDir;
}

/**
 * Gets or creates the receive directory.
 * In portable mode, uses local data directory.
 */
export function getReceiveDir(): string {
  const baseDir = isPortableMode() ? getDataDir() : app.getPath('documents');
  const receiveDir = path.join(baseDir, RECEIVE_SUBDIR);
  
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
 * Cleans up old temp files (older than CLEANUP_MAX_AGE_MS).
 */
export function cleanupTempDir(): void {
  const tempDir = getTempDir();
  const maxAgeThreshold = Date.now() - CLEANUP_MAX_AGE_MS;
  
  try {
    const files = fs.readdirSync(tempDir);
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtimeMs < maxAgeThreshold) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    console.warn('Temp cleanup failed:', err instanceof Error ? err.message : 'Unknown error');
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
  } catch (err) {
    console.warn('Failed to read directory:', err instanceof Error ? err.message : 'Unknown error');
  }
  
  return null;
}
