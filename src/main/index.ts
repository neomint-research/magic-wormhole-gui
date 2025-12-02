import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc/handlers';
import { cleanupTempDir, isPortableMode, getPortableDataDir } from './utils/paths';

let mainWindow: BrowserWindow | null = null;

// Configure portable mode before app is ready
if (isPortableMode()) {
  app.setPath('userData', getPortableDataDir());
}

// Single instance lock - prevents multiple instances competing for resources
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running - quit immediately
  app.quit();
} else {
  // Handle second instance launch attempt
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
  });

  app.on('window-all-closed', () => {
    cleanupTempDir();
    app.quit();
  });

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    }
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 520,
    minWidth: 360,
    minHeight: 420,
    maxWidth: 800,
    maxHeight: 900,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,  // Required: Drag&Drop needs file.path access.
                       // Risk mitigated by contextIsolation:true + restricted preload API.
      preload: path.join(__dirname, '../preload/index.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}
