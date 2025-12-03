/**
 * Wormhole Desktop - Renderer Process
 * 
 * Handles UI state management, DOM rendering, and user interactions.
 * Communicates with main process exclusively through the preload API (window.wormhole).
 */

import type {
  WormholeAPI,
  ProgressEvent,
  TransferCompleteEvent,
} from '../shared/types';

// Extend Window interface for wormhole API
declare global {
  interface Window {
    wormhole: WormholeAPI;
  }
}

// ---------------------------------------------------------------------------
// Theme Management
// ---------------------------------------------------------------------------

const THEME_KEY = 'wormhole-theme';

function getPreferredTheme(): string {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setTheme(theme: string): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme(): void {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(current === 'dark' ? 'light' : 'dark');
}

// Apply theme immediately to prevent flash
setTheme(getPreferredTheme());

// Global drag & drop - Chromium blocks drops without this
document.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
document.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILES = 100;
const MIN_PASSWORD_LENGTH = 4;

const STATUS = {
  IDLE: 'idle',
  FILES_SELECTED: 'files-selected',
  PACKAGING: 'packaging',
  SENDING: 'sending',
  CODE_ENTERED: 'code-entered',
  RECEIVING: 'receiving',
  SUCCESS: 'success',
  ERROR: 'error',
  DECRYPT_PROMPT: 'decrypt-prompt',
  DECRYPTING: 'decrypting',
  DECRYPT_SUCCESS: 'decrypt-success',
} as const;

type StatusType = typeof STATUS[keyof typeof STATUS];

const DOCKER = {
  CHECKING: 'checking',
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
} as const;

type DockerType = typeof DOCKER[keyof typeof DOCKER];

const ICONS = {
  upload: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  download: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  check: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:100;stroke-dashoffset:0"><polyline points="20 6 9 17 4 12"/></svg>',
  error: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  folder: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileItem {
  path: string;
  name: string;
}

interface ProgressData {
  percent: number;
  transferred: string;
  total: string;
}

type TransferPhase = 'waiting' | 'transferring' | 'complete' | null;

interface SendState {
  status: StatusType;
  items: FileItem[];
  encrypt: boolean;
  password: string;
  showPassword: boolean;
  progress: ProgressData | null;
  transferPhase: TransferPhase;
  code?: string;
  encrypted?: boolean;
  message?: string;
  details?: string;
}

interface ReceiveState {
  status: StatusType;
  progress: ProgressData | null;
  code?: string;
  filename?: string;
  path?: string;
  isEncrypted?: boolean;
  password?: string;
  showPassword?: boolean;
  extractedPath?: string;
  fileCount?: number;
  message?: string;
  details?: string;
}

interface AppState {
  tab: 'send' | 'receive';
  docker: DockerType;
  send: SendState;
  receive: ReceiveState;
}

type StateListener = (state: AppState) => void;

// ---------------------------------------------------------------------------
// State Management
// ---------------------------------------------------------------------------

let state: AppState = {
  tab: 'send',
  docker: DOCKER.CHECKING,
  send: { status: STATUS.IDLE, items: [], encrypt: false, password: '', showPassword: false, progress: null, transferPhase: null },
  receive: { status: STATUS.IDLE, progress: null },
};

const listeners: StateListener[] = [];

function subscribe(fn: StateListener): void { listeners.push(fn); }
function notify(): void { listeners.forEach(fn => fn(state)); }

function setState(partial: Partial<AppState>): void {
  state = { ...state, ...partial };
  notify();
}

function setSendState(send: Partial<SendState>): void { setState({ send: { ...state.send, ...send } }); }
function setReceiveState(receive: Partial<ReceiveState>): void { setState({ receive: { ...state.receive, ...receive } }); }

function setReceivePassword(password: string): void {
  setReceiveState({ password });
  requestAnimationFrame(() => {
    const input = $('decryptPassword') as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.setSelectionRange(password.length, password.length);
    }
  });
}

function toggleReceiveShowPassword(): void {
  setReceiveState({ showPassword: !state.receive.showPassword });
  requestAnimationFrame(() => {
    const input = $('decryptPassword') as HTMLInputElement | null;
    if (input) {
      input.focus();
      const len = (state.receive.password || '').length;
      input.setSelectionRange(len, len);
    }
  });
}

// ---------------------------------------------------------------------------
// File Management
// ---------------------------------------------------------------------------

function addFiles(paths: string[]): void {
  const { items } = state.send;
  const existing = new Set(items.map(i => i.path));
  const newItems = paths
    .filter(p => !existing.has(p))
    .map(p => ({ path: p, name: p.split(/[/\\]/).pop() || p }));

  if (newItems.length === 0) return;

  setSendState({
    status: STATUS.FILES_SELECTED,
    items: [...items, ...newItems].slice(0, MAX_FILES),
  });
}

function removeFile(index: number): void {
  const items = state.send.items.filter((_, i) => i !== index);
  setSendState(items.length
    ? { status: STATUS.FILES_SELECTED, items }
    : { status: STATUS.IDLE, items: [], encrypt: false, password: '', showPassword: false }
  );
}

function clearFiles(): void {
  setSendState({ status: STATUS.IDLE, items: [], encrypt: false, password: '', showPassword: false });
}

function setEncrypt(encrypt: boolean): void {
  setSendState({ encrypt, password: encrypt ? state.send.password : '', showPassword: false });
}

function setPassword(password: string): void {
  setSendState({ password });
  // Restore focus after re-render
  requestAnimationFrame(() => {
    const input = $('encryptPassword') as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.setSelectionRange(password.length, password.length);
    }
  });
}

function toggleShowPassword(): void {
  setSendState({ showPassword: !state.send.showPassword });
  requestAnimationFrame(() => {
    const input = $('encryptPassword') as HTMLInputElement | null;
    if (input) {
      input.focus();
      const len = state.send.password.length;
      input.setSelectionRange(len, len);
    }
  });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  const el = document.createElement('div');
  el.textContent = text;
  return el.innerHTML;
}

function $(id: string): HTMLElement | null { return document.getElementById(id); }

function isPasswordValid(): boolean {
  return !state.send.encrypt || state.send.password.length >= MIN_PASSWORD_LENGTH;
}

// ---------------------------------------------------------------------------
// Send Tab
// ---------------------------------------------------------------------------

let sendContainer: HTMLElement | null = null;

function renderSend(): void {
  if (!sendContainer) return;
  const s = state.send;
  sendContainer.innerHTML = getSendHTML(s);
  attachSendListeners(s);
}

function getSendHTML(s: SendState): string {
  const buttonText = s.encrypt && s.password.length >= MIN_PASSWORD_LENGTH ? 'Encrypt & Send' : 'Send';
  const buttonDisabled = s.status !== STATUS.FILES_SELECTED || !isPasswordValid();

  switch (s.status) {
    case STATUS.IDLE:
      return `
        <div class="dropzone dropzone-clickable" id="dropzone">
          <div class="dropzone-icon">${ICONS.upload}</div>
          <p class="dropzone-text">Drop files here to send</p>
          <p class="dropzone-subtext">or <button class="link-btn" id="browseFilesBtn">browse files</button> / <button class="link-btn" id="browseFolderBtn">folder</button></p>
        </div>
        <button class="btn btn-primary" id="sendBtn" disabled>Send</button>`;

    case STATUS.FILES_SELECTED:
      const items = s.items.map((item, i) => `
        <div class="file-item">
          <div class="file-item-info">
            <span class="file-item-name">${escapeHtml(item.name)}</span>
            <span class="file-item-path">${escapeHtml(item.path)}</span>
          </div>
          <button class="file-item-remove" data-index="${i}">&times;</button>
        </div>`).join('');

      return `
        <div class="dropzone dropzone-compact" id="dropzone">
          <span class="dropzone-text-small">Drop more or <button class="link-btn link-btn-small" id="browseFilesBtn">browse files</button> / <button class="link-btn link-btn-small" id="browseFolderBtn">folder</button></span>
        </div>
        <div class="file-list-container">
          <div class="file-list-header">
            <span>${s.items.length} item${s.items.length !== 1 ? 's' : ''}</span>
            <button class="clear-all-btn" id="clearAllBtn">Clear all</button>
          </div>
          <div class="file-list" id="fileList">${items}</div>
        </div>
        <div class="encrypt-row">
          <label class="encrypt-toggle">
            <input type="checkbox" id="encryptCheck" ${s.encrypt ? 'checked' : ''}>
            <span class="encrypt-label">${ICONS.lock} Encrypt</span>
          </label>
          <div class="password-wrapper ${s.encrypt ? '' : 'hidden'}">
            <input type="${s.showPassword ? 'text' : 'password'}" 
                   class="encrypt-password" 
                   id="encryptPassword" 
                   placeholder="Password (min ${MIN_PASSWORD_LENGTH} chars)"
                   value="${s.password}"
                   autocomplete="off">
            <button type="button" class="password-toggle" id="togglePassword" title="${s.showPassword ? 'Hide' : 'Show'} password">
              ${s.showPassword ? ICONS.eyeOff : ICONS.eye}
            </button>
          </div>
        </div>
        <button class="btn btn-primary ${s.encrypt ? 'btn-encrypt' : ''}" id="sendBtn" ${buttonDisabled ? 'disabled' : ''}>${buttonText}</button>`;

    case STATUS.PACKAGING:
      const packMsg = s.encrypt ? 'Encrypting files...' : 'Preparing files...';
      return `<div class="status-box"><div class="spinner"></div><p class="status-text">${packMsg}</p></div>`;

    case STATUS.SENDING:
      if (s.progress && s.progress.percent > 0) {
        return `
          <div class="status-box">
            <p class="status-text">Sending... ${s.progress.percent}%</p>
            <div class="progress-bar"><div class="progress-fill" style="width: ${s.progress.percent}%"></div></div>
            <p class="progress-detail">${s.progress.transferred} / ${s.progress.total}</p>
          </div>`;
      }
      return `<div class="status-box"><div class="spinner"></div><p class="status-text">Waiting for receiver...</p></div>`;

    case STATUS.SUCCESS:
      const encryptNote = s.encrypted
        ? `<p class="encrypt-note">${ICONS.lock} This transfer is password-protected</p>`
        : '';
      
      // Transfer status section based on phase
      let transferStatus = '';
      if (s.transferPhase === 'waiting') {
        transferStatus = `<div class="transfer-status transfer-waiting"><span class="pulse-dots"></span> Waiting for receiver</div>`;
      } else if (s.transferPhase === 'transferring' && s.progress) {
        transferStatus = `
          <div class="transfer-status transfer-active">
            <div class="progress-bar"><div class="progress-fill" style="width: ${s.progress.percent}%"></div></div>
            <p class="progress-text">Sending... ${s.progress.percent}%</p>
            <p class="progress-detail">${s.progress.transferred} / ${s.progress.total}</p>
          </div>`;
      } else if (s.transferPhase === 'complete') {
        transferStatus = `<div class="transfer-status transfer-complete"><span class="complete-check">${ICONS.check}</span> Transfer complete</div>`;
      }
      
      return `
        <div class="success-box">
          <div class="success-icon">${ICONS.check}</div>
          <p class="success-label">Share this code</p>
          <p class="code-display" id="codeDisplay">${s.code}</p>
          ${encryptNote}
          <button class="btn btn-ghost" id="copyBtn">${ICONS.copy}<span>Copy code</span></button>
          ${transferStatus}
        </div>
        <button class="btn btn-primary" id="resetSendBtn">Send more files</button>`;

    case STATUS.ERROR:
      return `
        <div class="error-box">
          <div class="error-icon">${ICONS.error}</div>
          <p class="error-message">${escapeHtml(s.message || 'Unknown error')}</p>
          ${s.details ? `<details><summary>Details</summary><pre>${escapeHtml(s.details)}</pre></details>` : ''}
        </div>
        <button class="btn btn-primary" id="resetSendBtn">Try again</button>`;

    default:
      return '';
  }
}

function attachSendListeners(s: SendState): void {
  const dropzone = $('dropzone');

  if (dropzone) {
    const clone = dropzone.cloneNode(true) as HTMLElement;
    dropzone.parentNode?.replaceChild(clone, dropzone);

    clone.addEventListener('dragenter', function(this: HTMLElement, e: DragEvent) { e.preventDefault(); e.stopPropagation(); this.classList.add('dropzone-hover'); });
    clone.addEventListener('dragover', function(this: HTMLElement, e: DragEvent) { e.preventDefault(); e.stopPropagation(); this.classList.add('dropzone-hover'); });
    clone.addEventListener('dragleave', function(this: HTMLElement, e: DragEvent) { e.preventDefault(); e.stopPropagation(); this.classList.remove('dropzone-hover'); });
    clone.addEventListener('drop', handleDrop);
    clone.addEventListener('click', (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.link-btn')) browseFiles(); });

    clone.querySelector('#browseFilesBtn')?.addEventListener('click', (e: Event) => { e.stopPropagation(); browseFiles(); });
    clone.querySelector('#browseFolderBtn')?.addEventListener('click', (e: Event) => { e.stopPropagation(); browseFolder(); });
  }

  $('sendBtn')?.addEventListener('click', handleSend);
  $('resetSendBtn')?.addEventListener('click', clearFiles);
  $('clearAllBtn')?.addEventListener('click', clearFiles);

  $('encryptCheck')?.addEventListener('change', (e: Event) => {
    setEncrypt((e.target as HTMLInputElement).checked);
  });

  $('encryptPassword')?.addEventListener('input', (e: Event) => {
    setPassword((e.target as HTMLInputElement).value);
  });

  $('togglePassword')?.addEventListener('click', toggleShowPassword);

  $('fileList')?.addEventListener('click', (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest('.file-item-remove') as HTMLElement | null;
    if (btn) removeFile(parseInt(btn.dataset.index || '0', 10));
  });

  const copyBtn = $('copyBtn');
  const codeDisplay = $('codeDisplay');
  if (copyBtn && codeDisplay) {
    copyBtn.addEventListener('click', () => {
      window.wormhole.copyToClipboard(codeDisplay.textContent || '');
      const span = copyBtn.querySelector('span');
      if (span) {
        span.textContent = 'Copied!';
        setTimeout(() => { span.textContent = 'Copy code'; }, 2000);
      }
    });
  }
}

function handleDrop(this: HTMLElement, e: DragEvent): void {
  e.preventDefault();
  e.stopPropagation();
  this.classList.remove('dropzone-hover');

  const files = e.dataTransfer?.files;
  if (!files?.length) return;

  const paths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const path = window.wormhole.getPathForFile(files[i]);
    if (path) paths.push(path);
  }
  if (paths.length) addFiles(paths);
}

async function browseFiles(): Promise<void> {
  try {
    const paths = await window.wormhole.getFilePaths();
    if (paths?.length) addFiles(paths);
  } catch (err) {
    console.error('Failed to browse files:', err);
  }
}

async function browseFolder(): Promise<void> {
  try {
    const paths = await window.wormhole.getFolderPath();
    if (paths?.length) addFiles(paths);
  } catch (err) {
    console.error('Failed to browse folder:', err);
  }
}

async function handleSend(): Promise<void> {
  const { items, encrypt, password } = state.send;
  if (!items.length) return;
  if (encrypt && password.length < MIN_PASSWORD_LENGTH) return;

  try {
    setSendState({ status: STATUS.PACKAGING });
    await new Promise(r => setTimeout(r, 100));

    setSendState({ status: STATUS.SENDING });
    const paths = items.map(i => i.path);
    const result = await window.wormhole.send(paths, encrypt ? password : undefined);

    if (result.success) {
      setSendState({
        status: STATUS.SUCCESS,
        code: result.data.code,
        encrypted: result.data.encrypted,
        transferPhase: 'waiting',
        items: [],
        encrypt: false,
        password: '',
      });
    } else {
      setSendState({
        status: STATUS.ERROR,
        message: result.error.message,
        details: result.error.details,
      });
    }
  } catch (err) {
    setSendState({
      status: STATUS.ERROR,
      message: 'Unexpected error occurred',
      details: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Receive Tab
// ---------------------------------------------------------------------------

let receiveContainer: HTMLElement | null = null;

function renderReceive(): void {
  if (!receiveContainer) return;
  const s = state.receive;
  receiveContainer.innerHTML = getReceiveHTML(s);
  attachReceiveListeners(s);
}

function getReceiveHTML(s: ReceiveState): string {
  const inputValue = s.code || '';
  const inputHtml = `<input type="text" class="input" id="codeInput" placeholder="Enter wormhole code" value="${inputValue}">`;

  switch (s.status) {
    case STATUS.IDLE:
    case STATUS.CODE_ENTERED:
      return `
        <div class="receive-box">
          <div class="receive-icon">${ICONS.download}</div>
          <p class="receive-text">Enter the code to receive files</p>
          <div class="receive-input-wrapper">
            ${inputHtml}
          </div>
          <button class="btn btn-primary" id="receiveBtn" ${s.status === STATUS.IDLE ? 'disabled' : ''}>Receive</button>
        </div>`;

    case STATUS.RECEIVING:
      if (s.progress && s.progress.percent > 0) {
        return `
          <div class="status-box">
            <p class="status-text">Receiving... ${s.progress.percent}%</p>
            <div class="progress-bar"><div class="progress-fill" style="width: ${s.progress.percent}%"></div></div>
            <p class="progress-detail">${s.progress.transferred} / ${s.progress.total}</p>
          </div>`;
      }
      return `<div class="status-box"><div class="spinner"></div><p class="status-text">Connecting...</p></div>`;

    case STATUS.SUCCESS:
      return `
        <div class="success-box">
          <div class="success-icon">${ICONS.check}</div>
          <p class="filename">${s.filename}</p>
          <p class="filepath">${s.path}</p>
          <button class="btn btn-ghost" id="openFolderBtn">${ICONS.folder}<span>Show in folder</span></button>
        </div>
        <button class="btn btn-primary" id="resetReceiveBtn">Receive more</button>`;

    case STATUS.DECRYPT_PROMPT:
      const decryptBtnDisabled = !s.password || s.password.length < MIN_PASSWORD_LENGTH;
      return `
        <div class="receive-box">
          <div class="success-icon">${ICONS.lock}</div>
          <p class="receive-text">This file is encrypted</p>
          <p class="filename">${s.filename}</p>
          <div class="encrypt-row" style="max-width: 300px; width: 100%;">
            <div class="password-wrapper">
              <input type="${s.showPassword ? 'text' : 'password'}" 
                     class="encrypt-password" 
                     id="decryptPassword" 
                     placeholder="Enter password"
                     value="${s.password || ''}"
                     autocomplete="off">
              <button type="button" class="password-toggle" id="toggleDecryptPassword" title="${s.showPassword ? 'Hide' : 'Show'} password">
                ${s.showPassword ? ICONS.eyeOff : ICONS.eye}
              </button>
            </div>
          </div>
          <button class="btn btn-primary btn-encrypt" id="decryptBtn" ${decryptBtnDisabled ? 'disabled' : ''} style="max-width: 300px;">Decrypt</button>
          <button class="btn btn-tertiary" id="skipDecryptBtn">Skip decryption</button>
        </div>`;

    case STATUS.DECRYPTING:
      return `<div class="status-box"><div class="spinner"></div><p class="status-text">Decrypting...</p></div>`;

    case STATUS.DECRYPT_SUCCESS:
      const fileWord = s.fileCount === 1 ? 'file' : 'files';
      return `
        <div class="success-box">
          <div class="success-icon">${ICONS.check}</div>
          <p class="filename">${s.fileCount} ${fileWord} extracted</p>
          <p class="filepath">${s.extractedPath}</p>
          <button class="btn btn-ghost" id="openFolderBtn">${ICONS.folder}<span>Show in folder</span></button>
        </div>
        <button class="btn btn-primary" id="resetReceiveBtn">Receive more</button>`;

    case STATUS.ERROR:
      return `
        <div class="error-box">
          <div class="error-icon">${ICONS.error}</div>
          <p class="error-message">${escapeHtml(s.message || 'Unknown error')}</p>
          ${s.details ? `<details><summary>Details</summary><pre>${escapeHtml(s.details)}</pre></details>` : ''}
        </div>
        <button class="btn btn-primary" id="resetReceiveBtn">Try again</button>`;

    default:
      return '';
  }
}

function setReceiveCode(code: string): void {
  setReceiveState({ status: code ? STATUS.CODE_ENTERED : STATUS.IDLE, code: code || undefined });
  requestAnimationFrame(() => {
    const input = $('codeInput') as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.setSelectionRange(code.length, code.length);
    }
  });
}

function attachReceiveListeners(s: ReceiveState): void {
  const codeInput = $('codeInput') as HTMLInputElement | null;
  const receiveBtn = $('receiveBtn') as HTMLButtonElement | null;

  if (codeInput) {
    codeInput.addEventListener('input', () => {
      const code = codeInput.value.trim();
      setReceiveCode(code);
      if (receiveBtn) receiveBtn.disabled = !code;
    });
    codeInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && codeInput.value.trim()) handleReceive();
    });
  }

  receiveBtn?.addEventListener('click', handleReceive);
  
  const folderPath = s.extractedPath || s.path;
  $('openFolderBtn')?.addEventListener('click', () => {
    if (folderPath) window.wormhole.openFolder(folderPath);
  });
  $('resetReceiveBtn')?.addEventListener('click', () => setReceiveState({ status: STATUS.IDLE }));

  // Decrypt prompt listeners
  $('decryptPassword')?.addEventListener('input', (e: Event) => {
    setReceivePassword((e.target as HTMLInputElement).value);
  });
  $('decryptPassword')?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (state.receive.password?.length || 0) >= MIN_PASSWORD_LENGTH) handleDecrypt();
  });
  $('toggleDecryptPassword')?.addEventListener('click', toggleReceiveShowPassword);
  $('decryptBtn')?.addEventListener('click', handleDecrypt);
  $('skipDecryptBtn')?.addEventListener('click', () => {
    setReceiveState({ status: STATUS.SUCCESS, isEncrypted: false });
  });
}

async function handleReceive(): Promise<void> {
  const { code } = state.receive;
  if (!code) return;

  try {
    setReceiveState({ status: STATUS.RECEIVING });
    const result = await window.wormhole.receive(code);

    if (result.success) {
      if (result.data.isEncrypted) {
        setReceiveState({
          status: STATUS.DECRYPT_PROMPT,
          filename: result.data.filename,
          path: result.data.savedPath,
          isEncrypted: true,
          password: '',
          showPassword: false,
        });
      } else {
        setReceiveState({
          status: STATUS.SUCCESS,
          filename: result.data.filename,
          path: result.data.savedPath,
          isEncrypted: false,
        });
      }
    } else {
      setReceiveState({ status: STATUS.ERROR, message: result.error.message, details: result.error.details });
    }
  } catch (err) {
    setReceiveState({ status: STATUS.ERROR, message: 'Unexpected error occurred', details: err instanceof Error ? err.message : String(err) });
  }
}

async function handleDecrypt(): Promise<void> {
  const { path, password } = state.receive;
  if (!password || password.length < MIN_PASSWORD_LENGTH) return;
  if (!path) return;

  try {
    setReceiveState({ status: STATUS.DECRYPTING });

    // Extract directory from archive path
    const lastSep = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    const outputDir = lastSep > 0 ? path.substring(0, lastSep) : path;

    const result = await window.wormhole.decrypt(path, password, outputDir);

    if (result.success) {
      setReceiveState({
        status: STATUS.DECRYPT_SUCCESS,
        extractedPath: result.data.extractedPath,
        fileCount: result.data.fileCount,
      });
    } else {
      setReceiveState({
        status: STATUS.ERROR,
        message: result.error.message,
        details: result.error.details,
      });
    }
  } catch (err) {
    setReceiveState({ status: STATUS.ERROR, message: 'Decryption failed', details: err instanceof Error ? err.message : String(err) });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function handleStateChange(): void {
  const tabSend = $('tabSend');
  const tabReceive = $('tabReceive');
  const contentSend = $('contentSend');
  const contentReceive = $('contentReceive');
  const dockerOverlay = $('dockerOverlay');

  tabSend?.classList.toggle('active', state.tab === 'send');
  tabReceive?.classList.toggle('active', state.tab === 'receive');
  contentSend?.classList.toggle('hidden', state.tab !== 'send');
  contentReceive?.classList.toggle('hidden', state.tab !== 'receive');

  if (dockerOverlay) {
    dockerOverlay.classList.toggle('hidden', state.docker === DOCKER.AVAILABLE);
    if (state.docker === DOCKER.CHECKING) {
      dockerOverlay.innerHTML = '<div class="spinner"></div><p>Checking Docker...</p>';
    } else if (state.docker === DOCKER.UNAVAILABLE) {
      dockerOverlay.innerHTML = '<p class="error-message">Docker is not available</p><button class="btn btn-primary" id="retryDockerBtn">Retry</button>';
      $('retryDockerBtn')?.addEventListener('click', checkDocker);
    }
  }

  state.tab === 'send' ? renderSend() : renderReceive();
}

async function checkDocker(): Promise<void> {
  setState({ docker: DOCKER.CHECKING });
  try {
    const result = await window.wormhole.checkDocker();
    setState({ docker: result.success && result.data.available ? DOCKER.AVAILABLE : DOCKER.UNAVAILABLE });
  } catch (err) {
    console.error('Docker check failed:', err);
    setState({ docker: DOCKER.UNAVAILABLE });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  sendContainer = $('contentSend');
  receiveContainer = $('contentReceive');

  $('tabSend')?.addEventListener('click', () => setState({ tab: 'send' }));
  $('tabReceive')?.addEventListener('click', () => setState({ tab: 'receive' }));
  $('themeToggle')?.addEventListener('click', toggleTheme);

  // Progress event listener
  window.wormhole.onProgress((event: ProgressEvent) => {
    if (event.type === 'send') {
      if (state.send.status === STATUS.SENDING) {
        setSendState({ progress: event });
      } else if (state.send.status === STATUS.SUCCESS && state.send.transferPhase !== 'complete') {
        setSendState({ progress: event, transferPhase: 'transferring' });
      }
    } else if (event.type === 'receive' && state.receive.status === STATUS.RECEIVING) {
      setReceiveState({ progress: event });
    }
  });

  // Transfer complete event listener
  window.wormhole.onTransferComplete((event: TransferCompleteEvent) => {
    if (event.type === 'send' && state.send.status === STATUS.SUCCESS) {
      setSendState({ transferPhase: 'complete', progress: null });
    }
  });

  subscribe(handleStateChange);
  handleStateChange();

  await checkDocker();
});
