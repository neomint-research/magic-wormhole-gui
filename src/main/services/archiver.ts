import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import Seven from 'node-7z';
import sevenBin from '7zip-bin';
import { Result, ErrorCode } from '../../shared/types';
import { ERROR_MESSAGES } from '../../shared/constants';
import { getTempDir, generateArchiveName } from '../utils/paths';

const pathTo7zip = sevenBin.path7za;

export interface ArchiveResult {
  archivePath: string;
  fileCount: number;
  encrypted: boolean;
}

export interface ArchiveOptions {
  password?: string;
}

export interface ExtractResult {
  extractedPath: string;
  fileCount: number;
}

export interface ExtractOptions {
  password: string;
  outputDir: string;
}

/**
 * Creates a 7z archive from multiple paths with AES-256 encryption.
 * Uses header encryption (-mhe) to also hide filenames.
 */
export async function createEncryptedArchive(
  paths: string[],
  password: string
): Promise<Result<ArchiveResult>> {
  const tempDir = getTempDir();
  const archiveName = generateArchiveName().replace('.zip', '.7z');
  const archivePath = path.join(tempDir, archiveName);

  return new Promise((resolve) => {
    try {
      // Validate all paths exist first
      for (const p of paths) {
        if (!fs.existsSync(p)) {
          resolve({
            success: false,
            error: {
              code: ErrorCode.PATH_NOT_FOUND,
              message: ERROR_MESSAGES[ErrorCode.PATH_NOT_FOUND],
              details: p,
            },
          });
          return;
        }
      }

      let fileCount = 0;

      const stream = Seven.add(archivePath, paths, {
        $bin: pathTo7zip,
        password: password,
        method: ['he'], // Header encryption - hides filenames
        recursive: true,
      });

      stream.on('data', () => {
        fileCount++;
      });

      stream.on('end', () => {
        resolve({
          success: true,
          data: {
            archivePath,
            fileCount: Math.max(fileCount, paths.length),
            encrypted: true,
          },
        });
      });

      stream.on('error', (err: Error) => {
        resolve({
          success: false,
          error: {
            code: ErrorCode.ARCHIVE_FAILED,
            message: ERROR_MESSAGES[ErrorCode.ARCHIVE_FAILED],
            details: err.message,
          },
        });
      });
    } catch (err) {
      resolve({
        success: false,
        error: {
          code: ErrorCode.ARCHIVE_FAILED,
          message: ERROR_MESSAGES[ErrorCode.ARCHIVE_FAILED],
          details: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
  });
}

/**
 * Creates a standard ZIP archive (no encryption).
 */
export async function createArchive(
  paths: string[]
): Promise<Result<ArchiveResult>> {
  const tempDir = getTempDir();
  const archiveName = generateArchiveName();
  const archivePath = path.join(tempDir, archiveName);

  return new Promise((resolve) => {
    try {
      const output = fs.createWriteStream(archivePath);
      const archive = archiver('zip', { zlib: { level: 6 } });

      let fileCount = 0;

      output.on('close', () => {
        resolve({
          success: true,
          data: {
            archivePath,
            fileCount,
            encrypted: false,
          },
        });
      });

      archive.on('error', (err) => {
        resolve({
          success: false,
          error: {
            code: ErrorCode.ARCHIVE_FAILED,
            message: ERROR_MESSAGES[ErrorCode.ARCHIVE_FAILED],
            details: err.message,
          },
        });
      });

      archive.on('entry', () => {
        fileCount++;
      });

      archive.pipe(output);

      for (const itemPath of paths) {
        if (!fs.existsSync(itemPath)) {
          resolve({
            success: false,
            error: {
              code: ErrorCode.PATH_NOT_FOUND,
              message: ERROR_MESSAGES[ErrorCode.PATH_NOT_FOUND],
              details: itemPath,
            },
          });
          return;
        }

        const stats = fs.statSync(itemPath);
        const name = path.basename(itemPath);

        if (stats.isDirectory()) {
          archive.directory(itemPath, name);
        } else {
          archive.file(itemPath, { name });
        }
      }

      archive.finalize();
    } catch (err) {
      resolve({
        success: false,
        error: {
          code: ErrorCode.ARCHIVE_FAILED,
          message: ERROR_MESSAGES[ErrorCode.ARCHIVE_FAILED],
          details: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
  });
}

/**
 * Extracts an encrypted 7z archive.
 */
export async function extractEncryptedArchive(
  archivePath: string,
  options: ExtractOptions
): Promise<Result<ExtractResult>> {
  const { password, outputDir } = options;

  return new Promise((resolve) => {
    try {
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      let fileCount = 0;

      const stream = Seven.extractFull(archivePath, outputDir, {
        $bin: pathTo7zip,
        password: password,
        yes: true, // Auto-confirm overwrites
      });

      stream.on('data', () => {
        fileCount++;
      });

      stream.on('end', () => {
        resolve({
          success: true,
          data: {
            extractedPath: outputDir,
            fileCount: Math.max(fileCount, 1),
          },
        });
      });

      stream.on('error', (err: Error) => {
        // Check for wrong password error
        const errorMsg = err.message.toLowerCase();
        if (errorMsg.includes('wrong password') || errorMsg.includes('cannot open encrypted')) {
          resolve({
            success: false,
            error: {
              code: ErrorCode.DECRYPT_FAILED,
              message: ERROR_MESSAGES[ErrorCode.DECRYPT_FAILED],
              details: 'Wrong password or corrupted archive',
            },
          });
        } else {
          resolve({
            success: false,
            error: {
              code: ErrorCode.EXTRACT_FAILED,
              message: ERROR_MESSAGES[ErrorCode.EXTRACT_FAILED],
              details: err.message,
            },
          });
        }
      });
    } catch (err) {
      resolve({
        success: false,
        error: {
          code: ErrorCode.EXTRACT_FAILED,
          message: ERROR_MESSAGES[ErrorCode.EXTRACT_FAILED],
          details: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
  });
}

/**
 * Checks if a file is an encrypted 7z archive.
 */
export function isEncrypted7z(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.7z');
}

/**
 * Determines if archiving is needed.
 * Archive if: multiple items OR any directory OR encryption requested.
 */
export function needsArchiving(paths: string[], password?: string): boolean {
  // Always archive if encryption is requested
  if (password) {
    return true;
  }

  if (paths.length > 1) {
    return true;
  }

  if (paths.length === 1) {
    try {
      const stats = fs.statSync(paths[0]);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  return false;
}
