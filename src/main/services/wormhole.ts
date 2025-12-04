import * as path from 'path';
import * as fs from 'fs';
import {
  Result,
  ErrorCode,
  SendRequest,
  SendResponse,
  ReceiveRequest,
  ReceiveResponse,
  DecryptRequest,
  DecryptResponse,
  ProgressEvent,
} from '../../shared/types';
import {
  ERROR_MESSAGES,
  CODE_VALIDATION_REGEX,
  WORMHOLE_TIMEOUT_MS,
  FILESYSTEM_SYNC_DELAY_MS,
} from '../../shared/constants';
import { toDockerPath, createReceiveSubdir, getFirstFileInDir } from '../utils/paths';
import { runDockerSend, runDockerCommandWithProgress } from './docker';
import {
  createArchive,
  createEncryptedArchive,
  extractEncryptedArchive,
  is7zArchive,
  needsArchiving,
} from './archiver';

/**
 * Sends files via wormhole.
 * Returns the code as soon as it's generated (doesn't wait for transfer to complete).
 */
export async function send(
  request: SendRequest,
  onProgress?: (event: ProgressEvent) => void,
  onComplete?: (success: boolean) => void
): Promise<Result<SendResponse>> {
  const { paths, password } = request;

  // Validation
  if (!paths || paths.length === 0) {
    return {
      success: false,
      error: {
        code: ErrorCode.EMPTY_PATHS,
        message: ERROR_MESSAGES[ErrorCode.EMPTY_PATHS],
      },
    };
  }

  // Check all paths exist
  for (const p of paths) {
    if (!fs.existsSync(p)) {
      return {
        success: false,
        error: {
          code: ErrorCode.PATH_NOT_FOUND,
          message: ERROR_MESSAGES[ErrorCode.PATH_NOT_FOUND],
          details: p,
        },
      };
    }
  }

  let filePath: string;
  let archiveUsed = false;
  let archivePath: string | undefined;
  let encrypted = false;

  // Archive if needed (multiple files, directory, or encryption)
  if (needsArchiving(paths, password)) {
    // Use encrypted 7z if password provided, else standard zip
    const archiveResult = password
      ? await createEncryptedArchive(paths, password)
      : await createArchive(paths);

    if (!archiveResult.success) {
      return archiveResult;
    }

    filePath = archiveResult.data.archivePath;
    archiveUsed = true;
    archivePath = filePath;
    encrypted = archiveResult.data.encrypted;
  } else {
    filePath = paths[0];
  }

  const fileName = path.basename(filePath);
  const hostDir = path.dirname(filePath);
  const dockerDir = toDockerPath(hostDir);

  // Run wormhole send - returns immediately when code is available
  const result = await runDockerSend(
    `/data/${fileName}`,
    { hostPath: dockerDir, containerPath: '/data' },
    WORMHOLE_TIMEOUT_MS,
    onProgress,
    onComplete
  );

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    data: {
      code: result.data.code,
      archiveUsed,
      archivePath,
      encrypted,
    },
  };
}

/**
 * Receives a file via wormhole.
 * Original filename is preserved by wormhole CLI.
 * Returns isEncrypted flag if the received file is a .7z archive.
 */
export async function receive(
  request: ReceiveRequest,
  onProgress?: (event: ProgressEvent) => void
): Promise<Result<ReceiveResponse>> {
  const { code } = request;

  // Validation
  if (!code || code.trim() === '') {
    return {
      success: false,
      error: {
        code: ErrorCode.EMPTY_CODE,
        message: ERROR_MESSAGES[ErrorCode.EMPTY_CODE],
      },
    };
  }

  const trimmedCode = code.trim();

  if (!CODE_VALIDATION_REGEX.test(trimmedCode)) {
    return {
      success: false,
      error: {
        code: ErrorCode.CODE_FORMAT,
        message: ERROR_MESSAGES[ErrorCode.CODE_FORMAT],
        details: `Received: ${trimmedCode}`,
      },
    };
  }

  // Create unique receive directory
  let receiveDir: string;
  try {
    receiveDir = createReceiveSubdir();
  } catch (err) {
    return {
      success: false,
      error: {
        code: ErrorCode.RECEIVE_DIR_FAILED,
        message: ERROR_MESSAGES[ErrorCode.RECEIVE_DIR_FAILED],
        details: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }

  const dockerDir = toDockerPath(receiveDir);

  // Run wormhole receive with progress tracking
  const result = await runDockerCommandWithProgress(
    ['wormhole', 'receive', '--accept-file', trimmedCode],
    { hostPath: dockerDir, containerPath: '/data', readOnly: false },
    WORMHOLE_TIMEOUT_MS,
    onProgress
  );

  if (!result.success) {
    return result;
  }

  // Brief delay for filesystem sync before reading directory
  await new Promise((resolve) => setTimeout(resolve, FILESYSTEM_SYNC_DELAY_MS));

  // Find the received file (wormhole saves with original filename)
  const receivedFile = getFirstFileInDir(receiveDir);

  if (!receivedFile) {
    return {
      success: false,
      error: {
        code: ErrorCode.TRANSFER_FAILED,
        message: ERROR_MESSAGES[ErrorCode.TRANSFER_FAILED],
        details: 'No file found after receive',
      },
    };
  }

  return {
    success: true,
    data: {
      filename: path.basename(receivedFile),
      savedPath: receivedFile,
      isEncrypted: is7zArchive(receivedFile),
    },
  };
}

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
