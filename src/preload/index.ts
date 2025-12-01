import { contextBridge, ipcRenderer } from 'electron';
import type { WormholeAPI, Result, SendResponse, ReceiveResponse, DockerStatus } from '../shared/types';

const api: WormholeAPI = {
  send: (paths: string[]): Promise<Result<SendResponse>> => {
    return ipcRenderer.invoke('wormhole:send', paths);
  },

  receive: (code: string): Promise<Result<ReceiveResponse>> => {
    return ipcRenderer.invoke('wormhole:receive', code);
  },

  checkDocker: (): Promise<Result<DockerStatus>> => {
    return ipcRenderer.invoke('docker:check');
  },

  getFilePaths: (): Promise<string[] | null> => {
    return ipcRenderer.invoke('dialog:openFiles');
  },

  openFolder: (path: string): Promise<void> => {
    return ipcRenderer.invoke('shell:openFolder', path);
  },

  copyToClipboard: (text: string): Promise<void> => {
    return ipcRenderer.invoke('clipboard:write', text);
  },
};

contextBridge.exposeInMainWorld('wormhole', api);
