import type { AppState, Tab, SendState, ReceiveState, DockerState } from '../shared/types';

// ============================================================
// INITIAL STATE
// ============================================================

export const initialState: AppState = {
  tab: 'send',
  docker: 'checking',
  send: { status: 'idle' },
  receive: { status: 'idle' },
};

// ============================================================
// STATE CONTAINER
// ============================================================

let currentState: AppState = { ...initialState };
let listeners: Array<(state: AppState) => void> = [];

export function getState(): AppState {
  return currentState;
}

export function subscribe(listener: (state: AppState) => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notify(): void {
  for (const listener of listeners) {
    listener(currentState);
  }
}

// ============================================================
// STATE UPDATES
// ============================================================

export function setTab(tab: Tab): void {
  currentState = { ...currentState, tab };
  notify();
}

export function setDockerState(docker: DockerState): void {
  currentState = { ...currentState, docker };
  notify();
}

export function setSendState(send: SendState): void {
  currentState = { ...currentState, send };
  notify();
}

export function setReceiveState(receive: ReceiveState): void {
  currentState = { ...currentState, receive };
  notify();
}

export function resetSend(): void {
  currentState = { ...currentState, send: { status: 'idle' } };
  notify();
}

export function resetReceive(): void {
  currentState = { ...currentState, receive: { status: 'idle' } };
  notify();
}
