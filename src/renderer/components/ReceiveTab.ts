import type { ReceiveState } from '../../shared/types';
import { getState, setReceiveState, resetReceive } from '../state';

let container: HTMLElement | null = null;
let currentDecryptPassword: string = '';

export function initReceiveTab(element: HTMLElement): void {
  container = element;
  render();
}

export function render(): void {
  if (!container) return;

  const state = getState().receive;
  container.innerHTML = getReceiveHTML(state);
  attachEventListeners(state);
}

function getReceiveHTML(state: ReceiveState): string {
  switch (state.status) {
    case 'idle':
      return `
        <div class="input-group">
          <input type="text" class="input" id="codeInput" placeholder="Enter wormhole code (e.g., 7-guitar-piano)">
        </div>
        <button class="btn btn-primary" id="receiveBtn" disabled>Receive</button>
      `;

    case 'code-entered':
      return `
        <div class="input-group">
          <input type="text" class="input" id="codeInput" value="${state.code}">
        </div>
        <button class="btn btn-primary" id="receiveBtn">Receive</button>
      `;

    case 'receiving':
      return `
        <div class="status-box">
          <div class="spinner"></div>
          <p>Receiving file...</p>
        </div>
        <button class="btn btn-primary" disabled>Receive</button>
      `;

    case 'success':
      if (state.isEncrypted) {
        // Show decrypt prompt for encrypted files
        return `
          <div class="success-box">
            <p class="success-label">Encrypted file received:</p>
            <p class="filename">${state.filename}</p>
            <p class="encrypted-badge">Encrypted (7z AES-256)</p>
            <div class="decrypt-section">
              <input type="password" class="input" id="decryptPassword" placeholder="Enter decryption password">
              <button class="btn btn-secondary" id="decryptBtn">Decrypt</button>
            </div>
            <p class="filepath">${state.path}</p>
            <button class="btn btn-tertiary" id="openFolderBtn">Open folder (without decrypt)</button>
          </div>
          <button class="btn btn-primary" id="resetBtn">Receive another</button>
        `;
      }
      return `
        <div class="success-box">
          <p class="success-label">File received:</p>
          <p class="filename">${state.filename}</p>
          <p class="filepath">${state.path}</p>
          <button class="btn btn-secondary" id="openFolderBtn">Open folder</button>
        </div>
        <button class="btn btn-primary" id="resetBtn">Receive another</button>
      `;

    case 'decrypting':
      return `
        <div class="status-box">
          <div class="spinner"></div>
          <p>Decrypting archive...</p>
        </div>
        <button class="btn btn-primary" disabled>Receive</button>
      `;

    case 'decrypt-success':
      return `
        <div class="success-box">
          <p class="success-label">Files decrypted successfully!</p>
          <p class="filename">${state.fileCount} file(s) extracted</p>
          <p class="filepath">${state.extractedPath}</p>
          <button class="btn btn-secondary" id="openFolderBtn">Open folder</button>
        </div>
        <button class="btn btn-primary" id="resetBtn">Receive another</button>
      `;

    case 'error':
      return `
        <div class="error-box">
          <p class="error-message">${state.message}</p>
          ${state.details ? `<details><summary>Technical details</summary><pre>${state.details}</pre></details>` : ''}
        </div>
        <button class="btn btn-primary" id="resetBtn">Try again</button>
      `;

    default:
      return '';
  }
}

function attachEventListeners(state: ReceiveState): void {
  const codeInput = document.getElementById('codeInput') as HTMLInputElement | null;
  const receiveBtn = document.getElementById('receiveBtn');
  const openFolderBtn = document.getElementById('openFolderBtn');
  const resetBtn = document.getElementById('resetBtn');
  const decryptPassword = document.getElementById('decryptPassword') as HTMLInputElement | null;
  const decryptBtn = document.getElementById('decryptBtn');

  if (codeInput) {
    codeInput.addEventListener('input', () => {
      const code = codeInput.value.trim();
      if (code) {
        setReceiveState({ status: 'code-entered', code });
      } else {
        setReceiveState({ status: 'idle' });
      }
      // Re-render only the button state
      const btn = document.getElementById('receiveBtn');
      if (btn) {
        (btn as HTMLButtonElement).disabled = !code;
      }
    });
  }

  if (receiveBtn && state.status === 'code-entered') {
    receiveBtn.addEventListener('click', handleReceive);
  }

  if (decryptPassword) {
    decryptPassword.addEventListener('input', () => {
      currentDecryptPassword = decryptPassword.value;
    });
    decryptPassword.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && currentDecryptPassword.trim()) {
        handleDecrypt();
      }
    });
  }

  if (decryptBtn && state.status === 'success' && state.isEncrypted) {
    decryptBtn.addEventListener('click', handleDecrypt);
  }

  if (openFolderBtn) {
    if (state.status === 'success') {
      openFolderBtn.addEventListener('click', () => {
        window.wormhole.openFolder(state.path);
      });
    } else if (state.status === 'decrypt-success') {
      openFolderBtn.addEventListener('click', () => {
        window.wormhole.openFolder(state.extractedPath);
      });
    }
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      currentDecryptPassword = '';
      resetReceive();
      render();
    });
  }
}

async function handleReceive(): Promise<void> {
  const state = getState().receive;
  if (state.status !== 'code-entered') return;

  const { code } = state;

  setReceiveState({ status: 'receiving' });
  render();

  const result = await window.wormhole.receive(code);

  if (result.success) {
    setReceiveState({
      status: 'success',
      filename: result.data.filename,
      path: result.data.savedPath,
      isEncrypted: result.data.isEncrypted,
    });
  } else {
    setReceiveState({
      status: 'error',
      message: result.error.message,
      details: result.error.details,
    });
  }

  render();
}

/**
 * Extracts parent directory from a file path (cross-platform).
 */
function getParentDir(filePath: string): string {
  // Normalize to forward slashes for consistent handling
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash > 0 ? normalized.substring(0, lastSlash) : normalized;
}

/**
 * Extracts filename without extension.
 */
function getBasename(filename: string): string {
  return filename.replace(/\.7z$/i, '');
}

async function handleDecrypt(): Promise<void> {
  const state = getState().receive;
  if (state.status !== 'success' || !state.isEncrypted) return;

  const password = currentDecryptPassword.trim();
  if (!password) {
    return;
  }

  const archivePath = state.path;
  const archiveDir = getParentDir(archivePath);
  const archiveName = getBasename(state.filename);
  const outputDir = `${archiveDir}/${archiveName}`;

  setReceiveState({ status: 'decrypting' });
  render();

  const result = await window.wormhole.decrypt(archivePath, password, outputDir);

  if (result.success) {
    currentDecryptPassword = '';
    setReceiveState({
      status: 'decrypt-success',
      extractedPath: result.data.extractedPath,
      fileCount: result.data.fileCount,
    });
  } else {
    // Return to success state with error message
    setReceiveState({
      status: 'error',
      message: result.error.message,
      details: result.error.details,
    });
  }

  render();
}
