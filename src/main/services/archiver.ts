import * as fs from 'fs';
import * as path from 'path';
import archiver, { ArchiverOptions } from 'archiver';
import { Result, ErrorCode } from '../../shared/types';
import { ERROR_MESSAGES } from '../../shared/constants';
import { getTempDir, generateArchiveName } from '../utils/paths';

// Register encrypted ZIP format (once at module load)
// eslint-disable-next-line @typescript-eslint/no-var-requires
archiver.registerFormat('zip-encrypted', require('archiver-zip-encrypted'));

// Extended options for encrypted archives
interface EncryptedArchiverOptions extends ArchiverOptions {
  encryptionMethod?: 'aes256' | 'zip20';
  password?: string;
}

export interface ArchiveResult {
  archivePath: string;
  fileCount: number;
  encrypted: boolean;
}

export interface ArchiveOptions {
  password?: string;
}

/**
 * Creates a ZIP archive from multiple paths.
 * If password is provided, creates an AES-256 encrypted archive.
 */
export async function createArchive(
  paths: string[],
  options: ArchiveOptions = {}
): Promise<Result<ArchiveResult>> {
  const tempDir = getTempDir();
  const archiveName = generateArchiveName();
  const archivePath = path.join(tempDir, archiveName);
  const { password } = options;

  return new Promise((resolve) => {
    try {
      const output = fs.createWriteStream(archivePath);

      // Use encrypted format if password provided
      const archive = password
        ? archiver.create('zip-encrypted', {
            zlib: { level: 6 },
            encryptionMethod: 'aes256',
            password,
          } as EncryptedArchiverOptions)
        : archiver('zip', { zlib: { level: 6 } });

      let fileCount = 0;

      output.on('close', () => {
        resolve({
          success: true,
          data: {
            archivePath,
            fileCount,
            encrypted: !!password,
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
