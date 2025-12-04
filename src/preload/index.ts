import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  WormholeAPI,
  Result,
  SendResponse,
  ReceiveResponse,
  DecryptResponse,
  DockerStatus,
  ProgressEvent,
  TransferCompleteEvent,
  TextPrepareResponse,
  TextReadResponse,
  SecureDeleteRequest,
  SecureDeleteResponse,
} from '../shared/types';

const api: WormholeAPI = {
  send: (paths: string[], password?: string): Promise<Result<SendResponse>> => {
    return ipcRenderer.invoke('wormhole:send', paths, password);
  },

  receive: (code: string): Promise<Result<ReceiveResponse>> => {
    return ipcRenderer.invoke('wormhole:receive', code);
  },

  decrypt: (archivePath: string, password: string, outputDir: string): Promise<Result<DecryptResponse>> => {
    return ipcRenderer.invoke('wormhole:decrypt', archivePath, password, outputDir);
  },

  checkDocker: (): Promise<Result<DockerStatus>> => {
    return ipcRenderer.invoke('docker:check');
  },

  getFilePaths: (): Promise<string[] | null> => {
    return ipcRenderer.invoke('dialog:openFiles');
  },

  getFolderPath: (): Promise<string[] | null> => {
    return ipcRenderer.invoke('dialog:openFolder');
  },

  openFolder: (path: string): Promise<void> => {
    return ipcRenderer.invoke('shell:openFolder', path);
  },

  copyToClipboard: (text: string): Promise<void> => {
    return ipcRenderer.invoke('clipboard:write', text);
  },

  getPathForFile: (file: File): string => {
    return webUtils.getPathForFile(file);
  },

  onProgress: (callback: (event: ProgressEvent) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ProgressEvent) => callback(data);
    ipcRenderer.on('wormhole:progress', handler);
    return () => ipcRenderer.removeListener('wormhole:progress', handler);
  },

  onTransferComplete: (callback: (event: TransferCompleteEvent) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: TransferCompleteEvent) => callback(data);
    ipcRenderer.on('wormhole:transfer-complete', handler);
    return () => ipcRenderer.removeListener('wormhole:transfer-complete', handler);
  },

  // Text message support
  prepareTextMessage: (text: string): Promise<Result<TextPrepareResponse>> => {
    return ipcRenderer.invoke('text:prepare', text);
  },

  readTextMessage: (filePath: string): Promise<Result<TextReadResponse>> => {
    return ipcRenderer.invoke('text:read', filePath);
  },

  // Secure delete support
  secureDelete: (request: SecureDeleteRequest): Promise<Result<SecureDeleteResponse>> => {
    return ipcRenderer.invoke('secure:delete', request);
  },
};

contextBridge.exposeInMainWorld('wormhole', api);
