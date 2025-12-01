import type { ReceiveState } from '../../shared/types';
import { getState, setReceiveState, resetReceive } from '../state';

let container: HTMLElement | null = null;

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
      return `
        <div class="success-box">
          <p class="success-label">File received:</p>
          <p class="filename">${state.filename}</p>
          <p class="filepath">${state.path}</p>
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
  }
}

function attachEventListeners(state: ReceiveState): void {
  const codeInput = document.getElementById('codeInput') as HTMLInputElement | null;
  const receiveBtn = document.getElementById('receiveBtn');
  const openFolderBtn = document.getElementById('openFolderBtn');
  const resetBtn = document.getElementById('resetBtn');

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

  if (openFolderBtn && state.status === 'success') {
    openFolderBtn.addEventListener('click', () => {
      window.wormhole.openFolder(state.path);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
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
