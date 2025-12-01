// ============================================================
// RENDERER BUNDLE - All renderer code in one file (no modules)
// ============================================================

(function() {
  'use strict';

  // Enable drag & drop globally - Chromium blocks drops by default
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  // ============================================================
  // STATE
  // ============================================================

  const initialState = {
    tab: 'send',
    docker: 'checking',
    send: { status: 'idle' },
    receive: { status: 'idle' },
  };

  let currentState = { ...initialState };
  let listeners = [];

  function getState() {
    return currentState;
  }

  function subscribe(listener) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }

  function notify() {
    for (const listener of listeners) {
      listener(currentState);
    }
  }

  function setTab(tab) {
    currentState = { ...currentState, tab };
    notify();
  }

  function setDockerState(docker) {
    currentState = { ...currentState, docker };
    notify();
  }

  function setSendState(send) {
    currentState = { ...currentState, send };
    notify();
  }

  function setReceiveState(receive) {
    currentState = { ...currentState, receive };
    notify();
  }

  function resetSend() {
    currentState = { ...currentState, send: { status: 'idle' } };
    notify();
  }

  function resetReceive() {
    currentState = { ...currentState, receive: { status: 'idle' } };
    notify();
  }

  // ============================================================
  // SEND TAB
  // ============================================================

  let sendContainer = null;
  let dropzoneListenersAttached = false;

  function initSendTab(element) {
    sendContainer = element;
    renderSend();
  }

  function renderSend() {
    if (!sendContainer) return;

    const state = getState().send;
    sendContainer.innerHTML = getSendHTML(state);
    attachSendEventListeners(state);
  }

  function getSendHTML(state) {
    switch (state.status) {
      case 'idle':
        return `
          <div class="dropzone" id="dropzone">
            <p class="dropzone-text">Drop files or folders here</p>
            <p class="dropzone-subtext">or use buttons below</p>
          </div>
          <div class="button-row">
            <button class="btn btn-secondary" id="browseFilesBtn">Select Files</button>
            <button class="btn btn-secondary" id="browseFolderBtn">Select Folder</button>
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
          <div class="button-row">
            <button class="btn btn-secondary" id="browseFilesBtn">Select Files</button>
            <button class="btn btn-secondary" id="browseFolderBtn">Select Folder</button>
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
          <button class="btn btn-primary" id="resetSendBtn">Send another</button>
        `;

      case 'error':
        return `
          <div class="error-box">
            <p class="error-message">${state.message}</p>
            ${state.details ? `<details><summary>Technical details</summary><pre>${state.details}</pre></details>` : ''}
          </div>
          <button class="btn btn-primary" id="resetSendBtn">Try again</button>
        `;
    }
  }

  function attachSendEventListeners(state) {
    const dropzone = document.getElementById('dropzone');
    const browseFilesBtn = document.getElementById('browseFilesBtn');
    const browseFolderBtn = document.getElementById('browseFolderBtn');
    const sendBtn = document.getElementById('sendBtn');
    const copyBtn = document.getElementById('copyBtn');
    const resetSendBtn = document.getElementById('resetSendBtn');
    const codeDisplay = document.getElementById('codeDisplay');

    if (dropzone) {
      // Remove old listeners by cloning
      const newDropzone = dropzone.cloneNode(true);
      dropzone.parentNode.replaceChild(newDropzone, dropzone);
      
      newDropzone.addEventListener('dragenter', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.add('dropzone-hover');
      });
      
      newDropzone.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.add('dropzone-hover');
      });
      
      newDropzone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dropzone-hover');
      });
      
      newDropzone.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dropzone-hover');
        
        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;

        const paths = [];
        const names = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.path) {
            paths.push(file.path);
            names.push(file.name);
          }
        }

        if (paths.length > 0) {
          setSendState({ status: 'files-selected', paths, names });
        }
      });
    }

    if (browseFilesBtn) {
      browseFilesBtn.addEventListener('click', handleBrowseFiles);
    }

    if (browseFolderBtn) {
      browseFolderBtn.addEventListener('click', handleBrowseFolder);
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

    if (resetSendBtn) {
      resetSendBtn.addEventListener('click', () => {
        resetSend();
      });
    }
  }

  async function handleBrowseFiles() {
    const paths = await window.wormhole.getFilePaths();
    if (!paths || paths.length === 0) return;

    const names = paths.map((p) => p.split(/[/\\]/).pop() || p);
    setSendState({ status: 'files-selected', paths, names });
  }

  async function handleBrowseFolder() {
    const paths = await window.wormhole.getFolderPath();
    if (!paths || paths.length === 0) return;

    const names = paths.map((p) => p.split(/[/\\]/).pop() || p);
    setSendState({ status: 'files-selected', paths, names });
  }

  async function handleSend() {
    const state = getState().send;
    if (state.status !== 'files-selected') return;

    const { paths } = state;

    setSendState({ status: 'packaging' });

    await new Promise((r) => setTimeout(r, 100));

    setSendState({ status: 'sending' });

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
  }

  // ============================================================
  // RECEIVE TAB
  // ============================================================

  let receiveContainer = null;

  function initReceiveTab(element) {
    receiveContainer = element;
    renderReceive();
  }

  function renderReceive() {
    if (!receiveContainer) return;

    const state = getState().receive;
    receiveContainer.innerHTML = getReceiveHTML(state);
    attachReceiveEventListeners(state);
  }

  function getReceiveHTML(state) {
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
          <button class="btn btn-primary" id="resetReceiveBtn">Receive another</button>
        `;

      case 'error':
        return `
          <div class="error-box">
            <p class="error-message">${state.message}</p>
            ${state.details ? `<details><summary>Technical details</summary><pre>${state.details}</pre></details>` : ''}
          </div>
          <button class="btn btn-primary" id="resetReceiveBtn">Try again</button>
        `;
    }
  }

  function attachReceiveEventListeners(state) {
    const codeInput = document.getElementById('codeInput');
    const receiveBtn = document.getElementById('receiveBtn');
    const openFolderBtn = document.getElementById('openFolderBtn');
    const resetReceiveBtn = document.getElementById('resetReceiveBtn');

    if (codeInput) {
      codeInput.addEventListener('input', () => {
        const code = codeInput.value.trim();
        if (code) {
          setReceiveState({ status: 'code-entered', code });
        } else {
          setReceiveState({ status: 'idle' });
        }
        const btn = document.getElementById('receiveBtn');
        if (btn) {
          btn.disabled = !code;
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

    if (resetReceiveBtn) {
      resetReceiveBtn.addEventListener('click', () => {
        resetReceive();
      });
    }
  }

  async function handleReceive() {
    const state = getState().receive;
    if (state.status !== 'code-entered') return;

    const { code } = state;

    setReceiveState({ status: 'receiving' });

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
  }

  // ============================================================
  // MAIN INITIALIZATION
  // ============================================================

  let tabSend = null;
  let tabReceive = null;
  let contentSend = null;
  let contentReceive = null;
  let dockerOverlay = null;

  document.addEventListener('DOMContentLoaded', async () => {
    tabSend = document.getElementById('tabSend');
    tabReceive = document.getElementById('tabReceive');
    contentSend = document.getElementById('contentSend');
    contentReceive = document.getElementById('contentReceive');
    dockerOverlay = document.getElementById('dockerOverlay');

    tabSend?.addEventListener('click', () => setTab('send'));
    tabReceive?.addEventListener('click', () => setTab('receive'));

    if (contentSend) initSendTab(contentSend);
    if (contentReceive) initReceiveTab(contentReceive);

    subscribe(handleStateChange);

    await checkDocker();
  });

  function handleStateChange() {
    const state = getState();

    tabSend?.classList.toggle('active', state.tab === 'send');
    tabReceive?.classList.toggle('active', state.tab === 'receive');

    contentSend?.classList.toggle('hidden', state.tab !== 'send');
    contentReceive?.classList.toggle('hidden', state.tab !== 'receive');

    if (dockerOverlay) {
      dockerOverlay.classList.toggle('hidden', state.docker === 'available');
      
      if (state.docker === 'checking') {
        dockerOverlay.innerHTML = '<div class="spinner"></div><p>Checking Docker...</p>';
      } else if (state.docker === 'unavailable') {
        dockerOverlay.innerHTML = `
          <p class="error-message">Docker is not available</p>
          <button class="btn btn-primary" id="retryDockerBtn">Retry</button>
        `;
        document.getElementById('retryDockerBtn')?.addEventListener('click', checkDocker);
      }
    }

    if (state.tab === 'send') {
      renderSend();
    } else {
      renderReceive();
    }
  }

  async function checkDocker() {
    setDockerState('checking');

    const result = await window.wormhole.checkDocker();

    if (result.success && result.data.available) {
      setDockerState('available');
    } else {
      setDockerState('unavailable');
    }
  }

})();
