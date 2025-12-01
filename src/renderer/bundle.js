(function() {
  'use strict';

  // ---------------------------------------------------------------------------
  // Theme Management
  // ---------------------------------------------------------------------------

  const THEME_KEY = 'wormhole-theme';

  function getPreferredTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  function toggleTheme() {
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
  };

  const DOCKER = {
    CHECKING: 'checking',
    AVAILABLE: 'available',
    UNAVAILABLE: 'unavailable',
  };

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
  };

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  let state = {
    tab: 'send',
    docker: DOCKER.CHECKING,
    send: { status: STATUS.IDLE, items: [], encrypt: false, password: '', showPassword: false },
    receive: { status: STATUS.IDLE },
  };

  const listeners = [];

  function getState() { return state; }
  function subscribe(fn) { listeners.push(fn); }
  function notify() { listeners.forEach(fn => fn(state)); }

  function setState(partial) {
    state = { ...state, ...partial };
    notify();
  }

  function setSendState(send) { setState({ send: { ...state.send, ...send } }); }
  function setReceiveState(receive) { setState({ receive }); }

  // ---------------------------------------------------------------------------
  // File Management
  // ---------------------------------------------------------------------------

  function addFiles(paths) {
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

  function removeFile(index) {
    const items = state.send.items.filter((_, i) => i !== index);
    setSendState(items.length
      ? { status: STATUS.FILES_SELECTED, items }
      : { status: STATUS.IDLE, items: [], encrypt: false, password: '', showPassword: false }
    );
  }

  function clearFiles() {
    setSendState({ status: STATUS.IDLE, items: [], encrypt: false, password: '', showPassword: false });
  }

  function setEncrypt(encrypt) {
    setSendState({ encrypt, password: encrypt ? state.send.password : '', showPassword: false });
  }

  function setPassword(password) {
    setSendState({ password });
    // Restore focus after re-render
    requestAnimationFrame(() => {
      const input = $('encryptPassword');
      if (input) {
        input.focus();
        input.setSelectionRange(password.length, password.length);
      }
    });
  }

  function toggleShowPassword() {
    setSendState({ showPassword: !state.send.showPassword });
    requestAnimationFrame(() => {
      const input = $('encryptPassword');
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

  function escapeHtml(text) {
    const el = document.createElement('div');
    el.textContent = text;
    return el.innerHTML;
  }

  function $(id) { return document.getElementById(id); }

  function isPasswordValid() {
    return !state.send.encrypt || state.send.password.length >= MIN_PASSWORD_LENGTH;
  }

  // ---------------------------------------------------------------------------
  // Send Tab
  // ---------------------------------------------------------------------------

  let sendContainer = null;

  function renderSend() {
    if (!sendContainer) return;
    const s = state.send;
    sendContainer.innerHTML = getSendHTML(s);
    attachSendListeners(s);
  }

  function getSendHTML(s) {
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
            <span class="dropzone-text-small">Drop more files or <button class="link-btn link-btn-small" id="browseFilesBtn">browse</button></span>
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
      case STATUS.SENDING:
        const msg = s.status === STATUS.PACKAGING
          ? (s.encrypt ? 'Encrypting files...' : 'Preparing files...')
          : 'Creating secure connection...';
        return `<div class="status-box"><div class="spinner"></div><p class="status-text">${msg}</p></div>`;

      case STATUS.SUCCESS:
        const encryptNote = s.encrypted
          ? `<p class="encrypt-note">${ICONS.lock} This transfer is password-protected</p>`
          : '';
        return `
          <div class="success-box">
            <div class="success-icon">${ICONS.check}</div>
            <p class="success-label">Share this code</p>
            <p class="code-display" id="codeDisplay">${s.code}</p>
            ${encryptNote}
            <button class="btn btn-ghost" id="copyBtn">${ICONS.copy}<span>Copy code</span></button>
          </div>
          <button class="btn btn-primary" id="resetSendBtn">Send more files</button>`;

      case STATUS.ERROR:
        return `
          <div class="error-box">
            <div class="error-icon">${ICONS.error}</div>
            <p class="error-message">${s.message}</p>
            ${s.details ? `<details><summary>Details</summary><pre>${s.details}</pre></details>` : ''}
          </div>
          <button class="btn btn-primary" id="resetSendBtn">Try again</button>`;

      default:
        return '';
    }
  }

  function attachSendListeners(s) {
    const dropzone = $('dropzone');

    if (dropzone) {
      const clone = dropzone.cloneNode(true);
      dropzone.parentNode.replaceChild(clone, dropzone);

      clone.addEventListener('dragenter', function(e) { e.preventDefault(); e.stopPropagation(); this.classList.add('dropzone-hover'); });
      clone.addEventListener('dragover', function(e) { e.preventDefault(); e.stopPropagation(); this.classList.add('dropzone-hover'); });
      clone.addEventListener('dragleave', function(e) { e.preventDefault(); e.stopPropagation(); this.classList.remove('dropzone-hover'); });
      clone.addEventListener('drop', handleDrop);
      clone.addEventListener('click', (e) => { if (!e.target.closest('.link-btn')) browseFiles(); });

      clone.querySelector('#browseFilesBtn')?.addEventListener('click', (e) => { e.stopPropagation(); browseFiles(); });
      clone.querySelector('#browseFolderBtn')?.addEventListener('click', (e) => { e.stopPropagation(); browseFolder(); });
    }

    $('sendBtn')?.addEventListener('click', handleSend);
    $('resetSendBtn')?.addEventListener('click', clearFiles);
    $('clearAllBtn')?.addEventListener('click', clearFiles);

    $('encryptCheck')?.addEventListener('change', (e) => {
      setEncrypt(e.target.checked);
    });

    $('encryptPassword')?.addEventListener('input', (e) => {
      setPassword(e.target.value);
    });

    $('togglePassword')?.addEventListener('click', toggleShowPassword);

    $('fileList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.file-item-remove');
      if (btn) removeFile(parseInt(btn.dataset.index, 10));
    });

    const copyBtn = $('copyBtn');
    const codeDisplay = $('codeDisplay');
    if (copyBtn && codeDisplay) {
      copyBtn.addEventListener('click', () => {
        window.wormhole.copyToClipboard(codeDisplay.textContent);
        const span = copyBtn.querySelector('span');
        span.textContent = 'Copied!';
        setTimeout(() => { span.textContent = 'Copy code'; }, 2000);
      });
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.remove('dropzone-hover');

    const files = e.dataTransfer.files;
    if (!files?.length) return;

    const paths = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].path) paths.push(files[i].path);
    }
    if (paths.length) addFiles(paths);
  }

  async function browseFiles() {
    try {
      const paths = await window.wormhole.getFilePaths();
      if (paths?.length) addFiles(paths);
    } catch (err) {
      console.error('Failed to browse files:', err);
    }
  }

  async function browseFolder() {
    try {
      const paths = await window.wormhole.getFolderPath();
      if (paths?.length) addFiles(paths);
    } catch (err) {
      console.error('Failed to browse folder:', err);
    }
  }

  async function handleSend() {
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
        details: err.message,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Receive Tab
  // ---------------------------------------------------------------------------

  let receiveContainer = null;

  function renderReceive() {
    if (!receiveContainer) return;
    const s = state.receive;
    receiveContainer.innerHTML = getReceiveHTML(s);
    attachReceiveListeners(s);
  }

  function getReceiveHTML(s) {
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

      case STATUS.ERROR:
        return `
          <div class="error-box">
            <div class="error-icon">${ICONS.error}</div>
            <p class="error-message">${s.message}</p>
            ${s.details ? `<details><summary>Details</summary><pre>${s.details}</pre></details>` : ''}
          </div>
          <button class="btn btn-primary" id="resetReceiveBtn">Try again</button>`;

      default:
        return '';
    }
  }

  function attachReceiveListeners(s) {
    const codeInput = $('codeInput');
    const receiveBtn = $('receiveBtn');

    if (codeInput) {
      codeInput.addEventListener('input', () => {
        const code = codeInput.value.trim();
        setReceiveState(code ? { status: STATUS.CODE_ENTERED, code } : { status: STATUS.IDLE });
        if (receiveBtn) receiveBtn.disabled = !code;
      });
      codeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && codeInput.value.trim()) handleReceive();
      });
    }

    receiveBtn?.addEventListener('click', handleReceive);
    $('openFolderBtn')?.addEventListener('click', () => window.wormhole.openFolder(s.path));
    $('resetReceiveBtn')?.addEventListener('click', () => setReceiveState({ status: STATUS.IDLE }));
  }

  async function handleReceive() {
    const { code } = state.receive;
    if (!code) return;

    try {
      setReceiveState({ status: STATUS.RECEIVING });
      const result = await window.wormhole.receive(code);

      if (result.success) {
        setReceiveState({ status: STATUS.SUCCESS, filename: result.data.filename, path: result.data.savedPath });
      } else {
        setReceiveState({ status: STATUS.ERROR, message: result.error.message, details: result.error.details });
      }
    } catch (err) {
      setReceiveState({ status: STATUS.ERROR, message: 'Unexpected error occurred', details: err.message });
    }
  }

  // ---------------------------------------------------------------------------
  // Main
  // ---------------------------------------------------------------------------

  function handleStateChange() {
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

  async function checkDocker() {
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

    subscribe(handleStateChange);
    handleStateChange();

    await checkDocker();
  });

})();
