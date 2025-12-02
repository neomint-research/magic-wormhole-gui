// ============================================================
// ERROR CODES
// ============================================================

export enum ErrorCode {
  // Docker errors
  DOCKER_NOT_INSTALLED = 'E_DOCKER_NOT_INSTALLED',
  DOCKER_NOT_RUNNING = 'E_DOCKER_NOT_RUNNING',
  DOCKER_IMAGE_MISSING = 'E_DOCKER_IMAGE_MISSING',
  DOCKER_TIMEOUT = 'E_DOCKER_TIMEOUT',
  DOCKER_EXIT_NONZERO = 'E_DOCKER_EXIT_NONZERO',

  // Filesystem errors
  PATH_NOT_FOUND = 'E_PATH_NOT_FOUND',
  PATH_NOT_READABLE = 'E_PATH_NOT_READABLE',
  ARCHIVE_FAILED = 'E_ARCHIVE_FAILED',
  TEMP_DIR_FAILED = 'E_TEMP_DIR_FAILED',
  RECEIVE_DIR_FAILED = 'E_RECEIVE_DIR_FAILED',

  // Wormhole errors
  CODE_PARSE_FAILED = 'E_CODE_PARSE_FAILED',
  TRANSFER_FAILED = 'E_TRANSFER_FAILED',
  CODE_INVALID = 'E_CODE_INVALID',

  // Validation errors
  EMPTY_PATHS = 'E_EMPTY_PATHS',
  EMPTY_CODE = 'E_EMPTY_CODE',
  CODE_FORMAT = 'E_CODE_FORMAT',

  // Encryption errors
  DECRYPT_FAILED = 'E_DECRYPT_FAILED',
  EXTRACT_FAILED = 'E_EXTRACT_FAILED',
  ARCHIVE_TOO_LARGE = 'E_ARCHIVE_TOO_LARGE',

  // Validation errors (input)
  INVALID_PASSWORD = 'E_INVALID_PASSWORD',
}

// ============================================================
// RESULT TYPES
// ============================================================

export interface SuccessResult<T> {
  success: true;
  data: T;
}

export interface ErrorResult {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: string;
  };
}

export type Result<T> = SuccessResult<T> | ErrorResult;

// ============================================================
// IPC TYPES
// ============================================================

export interface SendRequest {
  paths: string[];
  password?: string;
}

export interface SendResponse {
  code: string;
  archiveUsed: boolean;
  archivePath?: string;
  encrypted: boolean;
}

export interface ReceiveRequest {
  code: string;
}

export interface ReceiveResponse {
  filename: string;
  savedPath: string;
  isEncrypted: boolean;
}

export interface DecryptRequest {
  archivePath: string;
  password: string;
  outputDir: string;
}

export interface DecryptResponse {
  extractedPath: string;
  fileCount: number;
}

export interface ProgressEvent {
  type: 'send' | 'receive';
  percent: number;
  transferred: string;
  total: string;
}

export interface TransferCompleteEvent {
  type: 'send' | 'receive';
  success: boolean;
}

export interface DockerStatus {
  available: boolean;
  version?: string;
}

// ============================================================
// PROCESS TYPES
// ============================================================

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

// ============================================================
// UI STATE TYPES
// ============================================================

export type Tab = 'send' | 'receive';

export type DockerState = 'checking' | 'available' | 'unavailable';

export type SendState =
  | { status: 'idle' }
  | { status: 'files-selected'; paths: string[]; names: string[] }
  | { status: 'password-prompt'; paths: string[]; names: string[] }
  | { status: 'packaging' }
  | { status: 'sending' }
  | { status: 'success'; code: string; encrypted: boolean }
  | { status: 'error'; message: string; details?: string };

export type ReceiveState =
  | { status: 'idle' }
  | { status: 'code-entered'; code: string }
  | { status: 'receiving' }
  | { status: 'success'; filename: string; path: string; isEncrypted: boolean }
  | { status: 'decrypt-prompt'; filename: string; path: string }
  | { status: 'decrypting' }
  | { status: 'decrypt-success'; extractedPath: string; fileCount: number }
  | { status: 'error'; message: string; details?: string };

export interface AppState {
  tab: Tab;
  docker: DockerState;
  send: SendState;
  receive: ReceiveState;
}

// ============================================================
// PRELOAD API TYPE
// ============================================================

export interface WormholeAPI {
  send: (paths: string[], password?: string) => Promise<Result<SendResponse>>;
  receive: (code: string) => Promise<Result<ReceiveResponse>>;
  decrypt: (archivePath: string, password: string, outputDir: string) => Promise<Result<DecryptResponse>>;
  checkDocker: () => Promise<Result<DockerStatus>>;
  getFilePaths: () => Promise<string[] | null>;
  getFolderPath: () => Promise<string[] | null>;
  openFolder: (path: string) => Promise<void>;
  copyToClipboard: (text: string) => Promise<void>;
  getPathForFile: (file: File) => string;
  onProgress: (callback: (event: ProgressEvent) => void) => () => void;
  onTransferComplete: (callback: (event: TransferCompleteEvent) => void) => () => void;
}

declare global {
  interface Window {
    wormhole: WormholeAPI;
  }
}
