import { getState, subscribe, setTab, setDockerState } from './state';
import { initSendTab, render as renderSend } from './components/SendTab';
import { initReceiveTab, render as renderReceive } from './components/ReceiveTab';

// ============================================================
// DOM ELEMENTS
// ============================================================

let tabSend: HTMLElement | null = null;
let tabReceive: HTMLElement | null = null;
let contentSend: HTMLElement | null = null;
let contentReceive: HTMLElement | null = null;
let dockerOverlay: HTMLElement | null = null;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  tabSend = document.getElementById('tabSend');
  tabReceive = document.getElementById('tabReceive');
  contentSend = document.getElementById('contentSend');
  contentReceive = document.getElementById('contentReceive');
  dockerOverlay = document.getElementById('dockerOverlay');

  // Setup tab switching
  tabSend?.addEventListener('click', () => setTab('send'));
  tabReceive?.addEventListener('click', () => setTab('receive'));

  // Initialize components
  if (contentSend) initSendTab(contentSend);
  if (contentReceive) initReceiveTab(contentReceive);

  // Subscribe to state changes
  subscribe(handleStateChange);

  // Check Docker on startup
  await checkDocker();
});

// ============================================================
// STATE HANDLING
// ============================================================

function handleStateChange(): void {
  const state = getState();

  // Update tab states
  tabSend?.classList.toggle('active', state.tab === 'send');
  tabReceive?.classList.toggle('active', state.tab === 'receive');

  // Show/hide content
  contentSend?.classList.toggle('hidden', state.tab !== 'send');
  contentReceive?.classList.toggle('hidden', state.tab !== 'receive');

  // Docker overlay
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

  // Re-render active tab
  if (state.tab === 'send') {
    renderSend();
  } else {
    renderReceive();
  }
}

// ============================================================
// DOCKER CHECK
// ============================================================

async function checkDocker(): Promise<void> {
  setDockerState('checking');

  const result = await window.wormhole.checkDocker();

  if (result.success && result.data.available) {
    setDockerState('available');
  } else {
    setDockerState('unavailable');
  }
}
