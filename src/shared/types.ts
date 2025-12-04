// ============================================================
// ERROR CODES
// ============================================================

export enum ErrorCode {
  // Filesystem errors
  PATH_NOT_FOUND = 'E_PATH_NOT_FOUND',
  PATH_NOT_READABLE = 'E_PATH_NOT_READABLE',
  ARCHIVE_FAILED = 'E_ARCHIVE_FAILED',
  TEMP_DIR_FAILED = 'E_TEMP_DIR_FAILED',
  RECEIVE_DIR_FAILED = 'E_RECEIVE_DIR_FAILED',

  // Transfer errors
  TRANSFER_FAILED = 'E_TRANSFER_FAILED',

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

  // Secure delete errors
  SECURE_DELETE_FAILED = 'E_SECURE_DELETE_FAILED',
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

// ============================================================
// SECURE DELETE TYPES
// ============================================================

export interface SecureDeleteRequest {
  tempPaths?: string[];
  originalPaths?: string[];
}

export interface SecureDeleteResponse {
  deletedCount: number;
  failedPaths?: string[];
}

// ============================================================
// TEXT MESSAGE TYPES
// ============================================================

export interface TextPrepareResponse {
  filePath: string;
}

export interface TextReadResponse {
  wasTextMessage: boolean;
  content?: string;
}

// ============================================================
// PRELOAD API TYPE
// ============================================================

export interface WormholeAPI {
  send: (paths: string[], password?: string) => Promise<Result<SendResponse>>;
  receive: (code: string) => Promise<Result<ReceiveResponse>>;
  decrypt: (archivePath: string, password: string, outputDir: string) => Promise<Result<DecryptResponse>>;
  getFilePaths: () => Promise<string[] | null>;
  getFolderPath: () => Promise<string[] | null>;
  openFolder: (path: string) => Promise<void>;
  copyToClipboard: (text: string) => Promise<void>;
  getPathForFile: (file: File) => string;
  onProgress: (callback: (event: ProgressEvent) => void) => () => void;
  onTransferComplete: (callback: (event: TransferCompleteEvent) => void) => () => void;
  // Text message support
  prepareTextMessage: (text: string) => Promise<Result<TextPrepareResponse>>;
  readTextMessage: (filePath: string) => Promise<Result<TextReadResponse>>;
  // Secure delete support
  secureDelete: (request: SecureDeleteRequest) => Promise<Result<SecureDeleteResponse>>;
}

declare global {
  interface Window {
    wormhole: WormholeAPI;
  }
}
