import type { SendState } from '../../shared/types';
import { getState, setSendState, resetSend } from '../state';

let container: HTMLElement | null = null;

export function initSendTab(element: HTMLElement): void {
  container = element;
  render();
}

export function render(): void {
  if (!container) return;

  const state = getState().send;
  container.innerHTML = getSendHTML(state);
  attachEventListeners(state);
}

function getSendHTML(state: SendState): string {
  switch (state.status) {
    case 'idle':
      return `
        <div class="dropzone" id="dropzone">
          <p class="dropzone-text">Drop files or folders here</p>
          <p class="dropzone-subtext">or click to browse</p>
        </div>
        <button class="btn btn-primary" id="sendBtn" disabled>Send</button>
      `;

    case 'files-selected':
      const fileList = state.names.slice(0, 3).join(', ');
      const moreCount = state.names.length - 3;
      const displayText = moreCount > 0 ? `${fileList} +${moreCount} more` : fileList;
      return `
        <div class="dropzone dropzone-selected" id="dropzone">
          <p class="dropzone-text">${state.names.length} item(s) selected</p>
          <p class="dropzone-subtext">${displayText}</p>
        </div>
        <button class="btn btn-primary" id="sendBtn">Send</button>
      `;

    case 'packaging':
      return `
        <div class="status-box">
          <div class="spinner"></div>
          <p>Creating archive...</p>
        </div>
        <button class="btn btn-primary" disabled>Send</button>
      `;

    case 'sending':
      return `
        <div class="status-box">
          <div class="spinner"></div>
          <p>Sending via wormhole...</p>
        </div>
        <button class="btn btn-primary" disabled>Send</button>
      `;

    case 'success':
      return `
        <div class="success-box">
          <p class="success-label">Wormhole Code:</p>
          <p class="code-display" id="codeDisplay">${state.code}</p>
          <button class="btn btn-secondary" id="copyBtn">Copy to clipboard</button>
        </div>
        <button class="btn btn-primary" id="resetBtn">Send another</button>
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

function attachEventListeners(state: SendState): void {
  const dropzone = document.getElementById('dropzone');
  const sendBtn = document.getElementById('sendBtn');
  const copyBtn = document.getElementById('copyBtn');
  const resetBtn = document.getElementById('resetBtn');
  const codeDisplay = document.getElementById('codeDisplay');

  if (dropzone && (state.status === 'idle' || state.status === 'files-selected')) {
    dropzone.addEventListener('click', handleBrowse);
    dropzone.addEventListener('dragover', handleDragOver);
    dropzone.addEventListener('drop', handleDrop);
  }

  if (sendBtn && state.status === 'files-selected') {
    sendBtn.addEventListener('click', handleSend);
  }

  if (copyBtn && codeDisplay) {
    copyBtn.addEventListener('click', () => {
      window.wormhole.copyToClipboard(codeDisplay.textContent || '');
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy to clipboard'; }, 2000);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetSend();
      render();
    });
  }
}

function handleDragOver(e: DragEvent): void {
  e.preventDefault();
  e.stopPropagation();
}

function handleDrop(e: DragEvent): void {
  e.preventDefault();
  e.stopPropagation();

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const paths: string[] = [];
  const names: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i] as File & { path?: string };
    if (file.path) {
      paths.push(file.path);
      names.push(file.name);
    }
  }

  if (paths.length > 0) {
    setSendState({ status: 'files-selected', paths, names });
    render();
  }
}

async function handleBrowse(): Promise<void> {
  const paths = await window.wormhole.getFilePaths();
  if (!paths || paths.length === 0) return;

  const names = paths.map((p) => p.split(/[/\\]/).pop() || p);
  setSendState({ status: 'files-selected', paths, names });
  render();
}

async function handleSend(): Promise<void> {
  const state = getState().send;
  if (state.status !== 'files-selected') return;

  const { paths } = state;

  setSendState({ status: 'packaging' });
  render();

  // Small delay to show packaging state
  await new Promise((r) => setTimeout(r, 100));

  setSendState({ status: 'sending' });
  render();

  const result = await window.wormhole.send(paths);

  if (result.success) {
    setSendState({ status: 'success', code: result.data.code });
  } else {
    setSendState({
      status: 'error',
      message: result.error.message,
      details: result.error.details,
    });
  }

  render();
}
