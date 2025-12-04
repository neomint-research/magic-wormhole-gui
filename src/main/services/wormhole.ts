import * as fs from 'fs';
import {
  Result,
  ErrorCode,
  DecryptRequest,
  DecryptResponse,
} from '../../shared/types';
import { ERROR_MESSAGES } from '../../shared/constants';
import { extractEncryptedArchive } from './archiver';

/**
 * Decrypts a received 7z archive.
 */
export async function decrypt(request: DecryptRequest): Promise<Result<DecryptResponse>> {
  const { archivePath, password, outputDir } = request;

  // Validate archive exists
  if (!fs.existsSync(archivePath)) {
    return {
      success: false,
      error: {
        code: ErrorCode.PATH_NOT_FOUND,
        message: ERROR_MESSAGES[ErrorCode.PATH_NOT_FOUND],
        details: archivePath,
      },
    };
  }

  // Extract the archive
  const extractResult = await extractEncryptedArchive(archivePath, {
    password,
    outputDir,
  });

  if (!extractResult.success) {
    return extractResult;
  }

  return {
    success: true,
    data: {
      extractedPath: extractResult.data.extractedPath,
      fileCount: extractResult.data.fileCount,
    },
  };
}
