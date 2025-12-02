import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  WormholeAPI,
  Result,
  SendResponse,
  ReceiveResponse,
  DecryptResponse,
  DockerStatus,
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
};

contextBridge.exposeInMainWorld('wormhole', api);
