import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { getReceiveDir, isPortableMode, getPortableDataDir } from './paths';

/**
 * Allowed root directories for send operations.
 * Users can only send files from these locations.
 */
function getAllowedSendRoots(): string[] {
  const roots = [
    app.getPath('home'),
    app.getPath('documents'),
    app.getPath('downloads'),
    app.getPath('desktop'),
    app.getPath('temp'),
  ];

  // In portable mode, also allow the app's data directory
  if (isPortableMode()) {
    roots.push(getPortableDataDir());
  }

  return roots;
}

/**
 * Checks if a path is within allowed directories and safe from traversal.
 */
export function isPathSafe(targetPath: string, allowedRoots: string[]): boolean {
  // Block path traversal sequences
  if (targetPath.includes('..')) {
    return false;
  }

  const resolved = path.resolve(targetPath);

  return allowedRoots.some((root) => {
    const resolvedRoot = path.resolve(root);
    return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep);
  });
}

/**
 * Validates paths for send operations.
 * Returns null if valid, error message if invalid.
 */
export function validateSendPaths(paths: string[]): string | null {
  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return 'No paths provided';
  }

  const allowedRoots = getAllowedSendRoots();

  for (const p of paths) {
    if (typeof p !== 'string') {
      return 'Invalid path type';
    }

    if (!isPathSafe(p, allowedRoots)) {
      return `Path outside allowed directories: ${p}`;
    }

    if (!fs.existsSync(p)) {
      return `Path does not exist: ${p}`;
    }
  }

  return null;
}

/**
 * Validates output directory for decrypt operations.
 * Must be within the receive directory.
 */
export function validateDecryptOutputDir(outputDir: string): string | null {
  if (typeof outputDir !== 'string' || !outputDir) {
    return 'Invalid output directory';
  }

  if (outputDir.includes('..')) {
    return 'Path traversal not allowed';
  }

  const receiveDir = getReceiveDir();
  const resolvedOutput = path.resolve(outputDir);
  const resolvedReceive = path.resolve(receiveDir);

  if (!resolvedOutput.startsWith(resolvedReceive + path.sep) && resolvedOutput !== resolvedReceive) {
    return 'Output directory must be within receive folder';
  }

  return null;
}

/**
 * Validates archive path for decrypt operations.
 * Archive must be within the receive directory.
 */
export function validateArchivePath(archivePath: string): string | null {
  if (typeof archivePath !== 'string' || !archivePath) {
    return 'Invalid archive path';
  }

  if (archivePath.includes('..')) {
    return 'Path traversal not allowed';
  }

  // Archive must be within receive directory
  const receiveDir = getReceiveDir();
  const resolvedArchive = path.resolve(archivePath);
  const resolvedReceive = path.resolve(receiveDir);

  if (!resolvedArchive.startsWith(resolvedReceive + path.sep) && resolvedArchive !== resolvedReceive) {
    return 'Archive must be within receive directory';
  }

  if (!fs.existsSync(archivePath)) {
    return 'Archive does not exist';
  }

  if (!archivePath.toLowerCase().endsWith('.7z')) {
    return 'Not a 7z archive';
  }

  return null;
}

/**
 * Validates folder path for shell:openFolder.
 */
export function validateFolderPath(folderPath: string): string | null {
  if (typeof folderPath !== 'string' || !folderPath) {
    return 'Invalid folder path';
  }

  if (folderPath.includes('..')) {
    return 'Path traversal not allowed';
  }

  // Allow paths within receive directory or user-accessible locations
  const allowedRoots = [
    ...getAllowedSendRoots(),
    getReceiveDir(),
  ];

  if (!isPathSafe(folderPath, allowedRoots)) {
    return 'Folder outside allowed directories';
  }

  return null;
}

/**
 * Validates password parameter.
 */
export function validatePassword(password: unknown): string | null {
  if (password === undefined) {
    return null; // Optional
  }

  if (typeof password !== 'string') {
    return 'Invalid password type';
  }

  return null;
}

/**
 * Validates wormhole code format.
 */
export function validateCode(code: unknown): string | null {
  if (typeof code !== 'string' || !code.trim()) {
    return 'Invalid code';
  }

  return null;
}
