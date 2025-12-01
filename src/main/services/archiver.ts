import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { Result, ErrorCode } from '../../shared/types';
import { ERROR_MESSAGES } from '../../shared/constants';
import { getTempDir, generateArchiveName } from '../utils/paths';

export interface ArchiveResult {
  archivePath: string;
  fileCount: number;
}

/**
 * Creates a ZIP archive from multiple paths.
 * Returns the path to the created archive.
 */
export async function createArchive(paths: string[]): Promise<Result<ArchiveResult>> {
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
 * Archive if: multiple items OR any directory.
 */
export function needsArchiving(paths: string[]): boolean {
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
