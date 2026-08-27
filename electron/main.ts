import { app, BrowserWindow, ipcMain, clipboard, Notification, Tray, Menu, globalShortcut, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { registerKeyIPC } from './ipc/key';
import { registerShellIPC } from './ipc/shell';
import { registerChatIPC } from './ipc/chat';
import { registerGenerateIPC } from './ipc/generate';
import { registerFileIPC } from './ipc/file';
import { registerProactiveIPC } from './ipc/proactive';
import { registerMemoryIPC } from './ipc/memory';
import { registerEmotionIPC } from './ipc/emotion';
import { registerContextIPC } from './ipc/context';
import { registerDiaryIPC } from './ipc/diary';
import { registerSyncIPC } from './ipc/sync';
import { registerVoiceIPC } from './ipc/voice';
import { registerTTSIPC } from './services/tts';
import { registerUpdater } from './updater';

const isDev = !app.isPackaged;

// 应用根目录（原生 addon 解析用）：打包后 app.asar 根，dev 下项目根
process.env.APP_ROOT = app.getAppPath();
if (isDev) process.env.APP_ROOT = path.join(__dirname, '..');

let mainWin: BrowserWindow | null = null;
let tray: Tray | null = null;
/** 窗口是否允许真正关闭（关闭到托盘开关） */
let closeToTray = true;
/** 未读消息数（托盘红点用，由渲染进程上报） */
let unreadTotal = 0;
/** 用户是否主动点了「退出」（绕过关闭到托盘） */
let quitting = false;

/** 窗口记忆：持久化最后的大小/位置/最大化状态 */
const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');
let remembered: { x?: number; y?: number; width?: number; height?: number; maximized?: boolean } = {};

function loadWindowState(): void {
  try {
    remembered = JSON.parse(fs.readFileSync(WINDOW_STATE_FILE, 'utf8'));
  } catch {
    remembered = {};
  }
}

function saveWindowState(): void {
  try {
    const win = mainWin;
    if (!win) return;
    const isMax = win.isMaximized();
    const bounds = isMax ? (remembered as { width?: number; height?: number }) : win.getBounds();
    const state = { ...bounds, maximized: isMax };
    fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify(state), 'utf8');
  } catch {
    /* ignore */
  }
}

function showMainWindow(): void {
  if (!mainWin) return;
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
}

function createWindow(): BrowserWindow {
  loadWindowState();
  const width = remembered.width && remembered.width >= 900 ? remembered.width : 1200;
  const height = remembered.height && remembered.height >= 600 ? remembered.height : 800;

  const win = new BrowserWindow({
    width,
    height,
    x: remembered.x,
    y: remembered.y,
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
  mainWin = win;

  win.setMaximizable(false);

  win.once('ready-to-show', () => {
    if (remembered.maximized) win.maximize();
    win.show();
  });

  // 记忆窗口状态：移动/缩放/最大化/关闭时保存
  win.on('resize', () => saveWindowState());
  win.on('move', () => saveWindowState());
  win.on('maximize', () => saveWindowState());
  win.on('unmaximize', () => saveWindowState());
  win.on('close', (e) => {
    // 关闭到托盘：不是真正退出（登录态下），隐藏窗口
    if (closeToTray && tray && !quitting) {
      e.preventDefault();
      saveWindowState();
      win.hide();
    } else {
      saveWindowState();
    }
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

function createTray(): void {
  const iconPath = path.join(__dirname, '../resources/icon.png');
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('VirtuGene · Unlock Your Digital Soul');
  rebuildTrayMenu();

  tray.on('click', () => {
    showMainWindow();
  });
}

function rebuildTrayMenu(): void {
  if (!tray) return;
  const unreadLabel = unreadTotal > 0 ? `（${unreadTotal} 条未读）` : '';
  const menu = Menu.buildFromTemplate([
    { label: `VirtuGene${unreadLabel}`, enabled: false },
    { type: 'separator' },
    { label: '打开 VirtuGene', click: () => showMainWindow() },
    {
      label: '退出',
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
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
  registerContextIPC();
  registerDiaryIPC();
  registerSyncIPC();
  registerTTSIPC();
  registerVoiceIPC();

  const win = createWindow();

  if (app.isPackaged) {
    registerUpdater();
  }
  createTray();

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

  // 关闭行为设置：true=关闭到托盘，false=直接退出
  ipcMain.handle('window:setCloseToTray', (_e, { enabled }: { enabled: boolean }) => {
    closeToTray = enabled;
    return true;
  });

  ipcMain.handle('app:getVersion', () => app.getVersion());

  ipcMain.handle('clipboard:writeText', (_event, { text }: { text: string }) => {
    clipboard.writeText(text);
    return true;
  });

  // 系统通知（用于每日写日记提醒等）；支持点击回调直达会话
  ipcMain.handle('app:notify', (_event, { title, body, sessionId }: { title: string; body: string; sessionId?: string }) => {
    if (!Notification.isSupported()) return false;
    const n = new Notification({ title, body, silent: false });
    if (sessionId) {
      n.on('click', () => {
        showMainWindow();
        mainWin?.webContents.send('app:focus-session', { sessionId });
      });
    }
    n.show();
    return true;
  });

  // 渲染进程上报未读总数 → 更新托盘菜单红点
  ipcMain.handle('app:setUnreadTotal', (_e, { total }: { total: number }) => {
    unreadTotal = total;
    rebuildTrayMenu();
    return true;
  });

  ipcMain.on('window:minimize', () => win.minimize());
  ipcMain.on('window:maximize', () => {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on('window:close', () => win.close());

  // 全局快捷键：呼出/隐藏窗口
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (mainWin?.isVisible()) {
      mainWin.hide();
    } else {
      showMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // 托盘存在时不退出（关闭到托盘）
  if (!tray) app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
