import { ErrorCode } from './types';

// ============================================================
// PATHS
// ============================================================

export const DOCKER_IMAGE = 'wormhole-cli';
export const TEMP_SUBDIR = 'wormhole-transfers';
export const RECEIVE_SUBDIR = 'wormhole-received';
export const ARCHIVE_PREFIX = 'wormhole-transfer-';

// ============================================================
// TIMEOUTS
// ============================================================

export const DOCKER_CHECK_TIMEOUT_MS = 10_000;
export const WORMHOLE_TIMEOUT_MS = 120_000;

// ============================================================
// PATTERNS
// ============================================================

export const WORMHOLE_CODE_REGEX = /wormhole code is:\s*(\d+-\w+-\w+)/i;
export const CODE_VALIDATION_REGEX = /^\d+-\w+-\w+$/;

// ============================================================
// ERROR MESSAGES
// ============================================================

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.DOCKER_NOT_INSTALLED]: 'Docker is not installed on this system.',
  [ErrorCode.DOCKER_NOT_RUNNING]: 'Docker daemon is not running. Please start Docker Desktop.',
  [ErrorCode.DOCKER_IMAGE_MISSING]: 'Wormhole Docker image not found. Run: docker build -t wormhole-cli ./docker',
  [ErrorCode.DOCKER_TIMEOUT]: 'Docker operation timed out after 120 seconds.',
  [ErrorCode.DOCKER_EXIT_NONZERO]: 'Docker container exited with an error.',
  [ErrorCode.PATH_NOT_FOUND]: 'Selected file or folder does not exist.',
  [ErrorCode.PATH_NOT_READABLE]: 'Cannot read selected file or folder. Check permissions.',
  [ErrorCode.ARCHIVE_FAILED]: 'Failed to create archive from selected files.',
  [ErrorCode.TEMP_DIR_FAILED]: 'Failed to create temporary directory.',
  [ErrorCode.RECEIVE_DIR_FAILED]: 'Failed to create receive directory.',
  [ErrorCode.CODE_PARSE_FAILED]: 'Could not extract wormhole code from output.',
  [ErrorCode.TRANSFER_FAILED]: 'File transfer failed.',
  [ErrorCode.CODE_INVALID]: 'Invalid wormhole code received.',
  [ErrorCode.EMPTY_PATHS]: 'No files or folders selected.',
  [ErrorCode.EMPTY_CODE]: 'Please enter a wormhole code.',
  [ErrorCode.CODE_FORMAT]: 'Invalid code format. Expected: number-word-word',
};
