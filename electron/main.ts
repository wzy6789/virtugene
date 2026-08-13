import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { registerKeyIPC } from './ipc/key';
import { registerShellIPC } from './ipc/shell';
import { registerChatIPC } from './ipc/chat';
import { registerGenerateIPC } from './ipc/generate';
import { registerFileIPC } from './ipc/file';
import { registerProactiveIPC } from './ipc/proactive';
import { registerMemoryIPC } from './ipc/memory';
import { registerEmotionIPC } from './ipc/emotion';

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 320,
    height: 466,
    resizable: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0F0F1A',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Disable maximize button when in compact mode
  win.setMaximizable(false);

  win.once('ready-to-show', () => {
    win.show();
  });

  if (isDev) {
    loadDevServer(win, 'http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
  }

  return win;
}

function loadDevServer(win: BrowserWindow, url: string, retries = 10) {
  win.loadURL(url).catch(() => {
    if (retries > 0) {
      setTimeout(() => loadDevServer(win, url, retries - 1), 1000);
    }
  });
}

app.whenReady().then(() => {
  registerKeyIPC();
  registerShellIPC();
  registerChatIPC();
  registerGenerateIPC();
  registerFileIPC();
  registerProactiveIPC();
  registerMemoryIPC();
  registerEmotionIPC();

  const win = createWindow();

  // Resize window — expand after login, shrink after logout
  ipcMain.handle('window:setSize', (_event, { width, height }: { width: number; height: number }) => {
    if (width >= 900) {
      win.setMinimumSize(900, 600);
      win.setResizable(true);
      win.setMaximizable(true);
    } else {
      win.setMinimumSize(0, 0);
      win.setResizable(false);
      win.setMaximizable(false);
    }
    win.setSize(width, height);
    win.center();
    return true;
  });

  ipcMain.on('window:minimize', () => win.minimize());
  ipcMain.on('window:maximize', () => {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on('window:close', () => win.close());
});

app.on('window-all-closed', () => {
  app.quit();
});
