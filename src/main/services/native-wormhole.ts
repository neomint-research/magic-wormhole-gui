import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

// Types for native module (mirrors native/index.d.ts)
interface NativeProgressEvent {
  transferred: number;
  total: number;
  percent: number;
}

interface NativeReceiveOffer {
  filename: string;
  filesize: number;
}

type ProgressCallback = (err: Error | null, progress: NativeProgressEvent) => void;

interface NativeWormholeClient {
  createSendCode(codeLength?: number | null): Promise<string>;
  sendFile(filePath: string, progressCallback: ProgressCallback): Promise<void>;
  connectReceive(code: string): Promise<NativeReceiveOffer>;
  acceptTransfer(outputDir: string, progressCallback: ProgressCallback): Promise<string>;
  rejectTransfer(): Promise<void>;
  cancel(): void;
}

interface NativeWormholeClientConstructor {
  new(): NativeWormholeClient;
}

interface NativeModule {
  WormholeClient: NativeWormholeClientConstructor;
}

// Dynamic require for native module - handles both dev and packaged paths
function loadNativeModule(): NativeModule {
  // In development: use the local native/ directory
  // In production: use the extraResources path
  const devPath = path.join(__dirname, '..', '..', '..', 'native');
  const prodPath = path.join(process.resourcesPath || '', 'native');
  
  // Try production path first (more specific), then development
  const searchPaths = app.isPackaged ? [prodPath, devPath] : [devPath, prodPath];
  
  for (const searchPath of searchPaths) {
    const indexPath = path.join(searchPath, 'index.js');
    if (fs.existsSync(indexPath)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require(indexPath) as NativeModule;
    }
  }
  
  throw new Error(`Native module not found. Searched: ${searchPaths.join(', ')}`);
}

const nativeModule = loadNativeModule();
const WormholeClient = nativeModule.WormholeClient;
import {
  Result,
  ErrorCode,
  SendRequest,
  SendResponse,
  ReceiveRequest,
  ReceiveResponse,
  ProgressEvent,
} from '../../shared/types';
import {
  ERROR_MESSAGES,
  CODE_VALIDATION_REGEX,
} from '../../shared/constants';
import { createReceiveSubdir } from '../utils/paths';
import {
  createArchive,
  createEncryptedArchive,
  is7zArchive,
  needsArchiving,
} from './archiver';

// Module-level state for cancel support
let activeClient: NativeWormholeClient | null = null;

/**
 * Formats bytes to human-readable string (e.g., "1.5M", "256K")
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}G`;
}

/**
 * Creates a progress callback wrapper for send operations.
 * Converts native progress format to our ProgressEvent format.
 */
function createSendProgressCallback(
  onProgress?: (event: ProgressEvent) => void
): (err: Error | null, progress: NativeProgressEvent) => void {
  return (err: Error | null, progress: NativeProgressEvent) => {
    if (err) {
      console.error('[native-wormhole] Send progress error:', err);
    } else if (onProgress) {
      onProgress({
        type: 'send',
        percent: progress.percent,
        transferred: formatBytes(progress.transferred),
        total: formatBytes(progress.total),
      });
    }
  };
}

/**
 * Creates a progress callback wrapper for receive operations.
 * Converts native progress format to our ProgressEvent format.
 */
function createReceiveProgressCallback(
  onProgress?: (event: ProgressEvent) => void
): (err: Error | null, progress: NativeProgressEvent) => void {
  return (err: Error | null, progress: NativeProgressEvent) => {
    if (err) {
      console.error('[native-wormhole] Receive progress error:', err);
    } else if (onProgress) {
      onProgress({
        type: 'receive',
        percent: progress.percent,
        transferred: formatBytes(progress.transferred),
        total: formatBytes(progress.total),
      });
    }
  };
}

/**
 * Maps native errors to our Result error format.
 */
function mapError(err: unknown, defaultCode: ErrorCode = ErrorCode.TRANSFER_FAILED): Result<never> {
  const message = err instanceof Error ? err.message : String(err);
  const details = err instanceof Error ? err.stack : undefined;
  
  return {
    success: false,
    error: {
      code: defaultCode,
      message: ERROR_MESSAGES[defaultCode],
      details: message + (details ? `\n${details}` : ''),
    },
  };
}

/**
 * Sends files via native wormhole.
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

  // Create native client
  const client = new WormholeClient();
  activeClient = client;

  try {
    // Generate code - returns immediately after mailbox connection
    // The PAKE exchange (waiting for receiver) happens in sendFile()
    const code = await client.createSendCode();

    // Start transfer in background (don't await fully)
    const transferPromise = client.sendFile(filePath, createSendProgressCallback(onProgress));

    // Handle completion asynchronously
    transferPromise
      .then(() => {
        activeClient = null;
        if (onComplete) onComplete(true);
      })
      .catch((err) => {
        console.error('[native-wormhole] Transfer failed:', err);
        activeClient = null;
        if (onComplete) onComplete(false);
      });

    return {
      success: true,
      data: {
        code,
        archiveUsed,
        archivePath,
        encrypted,
      },
    };
  } catch (err) {
    activeClient = null;
    return mapError(err);
  }
}

/**
 * Receives a file via native wormhole.
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

  // Create native client
  const client = new WormholeClient();
  activeClient = client;

  try {
    // Connect and get offer info
    const offer = await client.connectReceive(trimmedCode);
    
    // Accept and receive the file
    const savedPath = await client.acceptTransfer(receiveDir, createReceiveProgressCallback(onProgress));
    
    activeClient = null;

    return {
      success: true,
      data: {
        filename: offer.filename,
        savedPath,
        isEncrypted: is7zArchive(savedPath),
      },
    };
  } catch (err) {
    activeClient = null;
    return mapError(err);
  }
}

/**
 * Cancels any active transfer operation.
 */
export function cancelTransfer(): void {
  if (activeClient) {
    activeClient.cancel();
    activeClient = null;
  }
}
