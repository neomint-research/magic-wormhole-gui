import { ErrorCode } from './types';

// ============================================================
// PATHS
// ============================================================

export const TEMP_SUBDIR = 'wormhole-transfers';
export const RECEIVE_SUBDIR = 'wormhole-received';
export const ARCHIVE_PREFIX = 'wormhole-transfer-';

// ============================================================
// LIMITS
// ============================================================

export const MAX_ARCHIVE_SIZE_BYTES = 50 * 1024 * 1024 * 1024; // 50 GB
export const CLEANUP_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// ============================================================
// TEXT MESSAGE
// ============================================================

export const TEXT_MESSAGE_FILENAME = 'wormhole-message.txt';
export const TEXT_MAX_LENGTH = 10_000;

// ============================================================
// PATTERNS
// ============================================================

export const CODE_VALIDATION_REGEX = /^\d+-\w+-\w+$/;

// ============================================================
// ERROR MESSAGES
// ============================================================

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.PATH_NOT_FOUND]: 'Selected file or folder does not exist.',
  [ErrorCode.PATH_NOT_READABLE]: 'Cannot read selected file or folder. Check permissions.',
  [ErrorCode.ARCHIVE_FAILED]: 'Failed to create archive from selected files.',
  [ErrorCode.TEMP_DIR_FAILED]: 'Failed to create temporary directory.',
  [ErrorCode.RECEIVE_DIR_FAILED]: 'Failed to create receive directory.',
  [ErrorCode.TRANSFER_FAILED]: 'File transfer failed.',
  [ErrorCode.EMPTY_PATHS]: 'No files or folders selected.',
  [ErrorCode.EMPTY_CODE]: 'Please enter a wormhole code.',
  [ErrorCode.CODE_FORMAT]: 'Invalid code format. Expected: number-word-word',
  [ErrorCode.DECRYPT_FAILED]: 'Decryption failed. Wrong password or corrupted archive.',
  [ErrorCode.EXTRACT_FAILED]: 'Failed to extract archive.',
  [ErrorCode.ARCHIVE_TOO_LARGE]: 'Archive exceeds maximum allowed size (50 GB).',
  [ErrorCode.INVALID_PASSWORD]: 'Invalid password provided.',
  [ErrorCode.SECURE_DELETE_FAILED]: 'Failed to securely delete one or more files.',
};
