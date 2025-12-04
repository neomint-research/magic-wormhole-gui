/**
 * Secure Delete Utility
 * 
 * Provides best-effort secure file deletion by overwriting file contents
 * with cryptographically strong random data before unlinking.
 * 
 * IMPORTANT: On SSDs and copy-on-write filesystems (APFS, Btrfs, ZFS),
 * forensic recovery cannot be fully prevented due to wear leveling and
 * copy-on-write behavior. This implementation provides best-effort security.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { Result, ErrorCode, SecureDeleteResponse } from '../../shared/types';

/** Chunk size for overwrite operations (64KB) */
const CHUNK_SIZE = 64 * 1024;

/** Number of overwrite passes */
const OVERWRITE_PASSES = 3;

/**
 * Securely overwrites a single file with random data, then deletes it.
 * 
 * Algorithm:
 * 1. Get file size
 * 2. Open file for read/write
 * 3. Pass 1: Overwrite with random data + fsync
 * 4. Pass 2: Overwrite with random data + fsync
 * 5. Pass 3: Overwrite with zeros + fsync
 * 6. Close file
 * 7. Unlink file
 * 
 * @param filePath - Absolute path to the file to delete
 * @throws Error if file doesn't exist or can't be written
 */
async function secureOverwriteFile(filePath: string): Promise<void> {
  // Use lstat to NOT follow symlinks - we want to check the link itself
  const stats = await fs.promises.lstat(filePath);
  
  // Refuse to process symlinks - security risk
  if (stats.isSymbolicLink()) {
    throw new Error(`Refusing to delete symlink: ${filePath}`);
  }
  
  if (!stats.isFile()) {
    throw new Error(`Not a file: ${filePath}`);
  }
  
  const fileSize = stats.size;
  
  // Skip overwrite for empty files, just delete
  if (fileSize === 0) {
    await fs.promises.unlink(filePath);
    return;
  }
  
  // Open file for read/write (r+ mode allows overwriting existing content)
  const fileHandle = await fs.promises.open(filePath, 'r+');
  
  try {
    // Prepare buffers
    const chunkBuffer = Buffer.alloc(Math.min(CHUNK_SIZE, fileSize));
    const zeroBuffer = Buffer.alloc(Math.min(CHUNK_SIZE, fileSize), 0);
    
    // Pass 1 & 2: Random data
    for (let pass = 0; pass < OVERWRITE_PASSES - 1; pass++) {
      let bytesWritten = 0;
      
      while (bytesWritten < fileSize) {
        const bytesToWrite = Math.min(CHUNK_SIZE, fileSize - bytesWritten);
        const buffer = bytesToWrite === chunkBuffer.length 
          ? chunkBuffer 
          : Buffer.alloc(bytesToWrite);
        
        crypto.randomFillSync(buffer);
        await fileHandle.write(buffer, 0, bytesToWrite, bytesWritten);
        bytesWritten += bytesToWrite;
      }
      
      // Sync to disk after each pass
      await fileHandle.sync();
    }
    
    // Pass 3: Zeros (helps hide that secure deletion occurred)
    let bytesWritten = 0;
    while (bytesWritten < fileSize) {
      const bytesToWrite = Math.min(CHUNK_SIZE, fileSize - bytesWritten);
      const buffer = bytesToWrite === zeroBuffer.length 
        ? zeroBuffer 
        : Buffer.alloc(bytesToWrite, 0);
      
      await fileHandle.write(buffer, 0, bytesToWrite, bytesWritten);
      bytesWritten += bytesToWrite;
    }
    
    // Final sync
    await fileHandle.sync();
    
  } finally {
    // Always close the file handle
    await fileHandle.close();
  }
  
  // Delete the file
  await fs.promises.unlink(filePath);
}

/**
 * Securely deletes multiple files.
 * Continues processing remaining files if one fails.
 * 
 * @param paths - Array of file paths to securely delete
 * @returns Result with count of deleted files and list of failed paths
 */
export async function secureDeleteFiles(paths: string[]): Promise<Result<SecureDeleteResponse>> {
  if (!paths || paths.length === 0) {
    return {
      success: true,
      data: { deletedCount: 0 },
    };
  }
  
  let deletedCount = 0;
  const failedPaths: string[] = [];
  
  for (const filePath of paths) {
    try {
      // Verify path exists before attempting deletion
      if (!fs.existsSync(filePath)) {
        // File already gone - count as success
        deletedCount++;
        continue;
      }
      
      // Use lstatSync to NOT follow symlinks
      const stats = fs.lstatSync(filePath);
      
      // Skip symlinks - security risk
      if (stats.isSymbolicLink()) {
        console.warn(`Skipping symlink: ${filePath}`);
        failedPaths.push(filePath);
        continue;
      }
      
      if (stats.isDirectory()) {
        // For directories, recursively delete contents then remove dir
        await secureDeleteDirectory(filePath);
        deletedCount++;
      } else {
        await secureOverwriteFile(filePath);
        deletedCount++;
      }
    } catch (err) {
      console.error(`Failed to securely delete ${filePath}:`, err);
      failedPaths.push(filePath);
    }
  }
  
  // Return success even if some files failed - report failures in response
  if (failedPaths.length > 0) {
    return {
      success: false,
      error: {
        code: ErrorCode.SECURE_DELETE_FAILED,
        message: `Failed to delete ${failedPaths.length} file(s)`,
        details: failedPaths.join(', '),
      },
    };
  }
  
  return {
    success: true,
    data: {
      deletedCount,
    },
  };
}

/**
 * Recursively securely deletes a directory and its contents.
 * Files are overwritten before deletion, directories are removed after emptying.
 * 
 * @param dirPath - Path to directory to delete
 */
async function secureDeleteDirectory(dirPath: string): Promise<void> {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    // Skip symlinks - security risk (could point outside directory)
    if (entry.isSymbolicLink()) {
      console.warn(`Skipping symlink in directory: ${fullPath}`);
      // Remove the symlink itself (not its target) to allow directory deletion
      try {
        await fs.promises.unlink(fullPath);
      } catch (err) {
        console.warn(`Failed to remove symlink: ${fullPath}`);
      }
      continue;
    }
    
    if (entry.isDirectory()) {
      await secureDeleteDirectory(fullPath);
    } else {
      await secureOverwriteFile(fullPath);
    }
  }
  
  // Remove empty directory
  await fs.promises.rmdir(dirPath);
}

/**
 * Performs secure deletion with combined temp and original paths.
 * This is the main entry point for the IPC handler.
 * 
 * @param tempPaths - Temporary files (archives) to delete
 * @param originalPaths - Original user files to delete
 * @returns Combined result of all deletions
 */
export async function secureDelete(
  tempPaths?: string[],
  originalPaths?: string[]
): Promise<Result<SecureDeleteResponse>> {
  const allPaths = [
    ...(tempPaths || []),
    ...(originalPaths || []),
  ];
  
  return secureDeleteFiles(allPaths);
}
