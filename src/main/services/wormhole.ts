import * as path from 'path';
import * as fs from 'fs';
import {
  Result,
  ErrorCode,
  SendRequest,
  SendResponse,
  ReceiveRequest,
  ReceiveResponse,
} from '../../shared/types';
import {
  ERROR_MESSAGES,
  CODE_VALIDATION_REGEX,
  WORMHOLE_TIMEOUT_MS,
} from '../../shared/constants';
import { toDockerPath, createReceiveSubdir, getFirstFileInDir } from '../utils/paths';
import { runDockerCommand, runDockerSend } from './docker';
import { createArchive, needsArchiving } from './archiver';

/**
 * Sends files via wormhole.
 * Returns the code as soon as it's generated (doesn't wait for transfer to complete).
 */
export async function send(request: SendRequest): Promise<Result<SendResponse>> {
  const { paths } = request;

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

  // Archive if needed
  if (needsArchiving(paths)) {
    const archiveResult = await createArchive(paths);
    
    if (!archiveResult.success) {
      return archiveResult;
    }

    filePath = archiveResult.data.archivePath;
    archiveUsed = true;
    archivePath = filePath;
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
    WORMHOLE_TIMEOUT_MS
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
    },
  };
}

/**
 * Receives a file via wormhole.
 * Original filename is preserved by wormhole CLI.
 */
export async function receive(request: ReceiveRequest): Promise<Result<ReceiveResponse>> {
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

  // Run wormhole receive
  // NOTE: No --output-file flag - wormhole preserves original filename
  const result = await runDockerCommand(
    ['wormhole', 'receive', '--accept-file', trimmedCode],
    { hostPath: dockerDir, containerPath: '/data', readOnly: false },
    WORMHOLE_TIMEOUT_MS
  );

  if (!result.success) {
    return result;
  }

  // Brief delay for filesystem sync before reading directory
  await new Promise((resolve) => setTimeout(resolve, 100));

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
    },
  };
}
