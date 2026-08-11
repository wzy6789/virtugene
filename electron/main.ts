import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { registerKeyIPC } from './ipc/key';
import { registerShellIPC } from './ipc/shell';

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0F0F1A',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  registerKeyIPC();
  registerShellIPC();

  const win = createWindow();

  ipcMain.on('window:minimize', () => win.minimize());
  ipcMain.on('window:maximize', () => {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on('window:close', () => win.close());
});

app.on('window-all-closed', () => {
  app.quit();
});
