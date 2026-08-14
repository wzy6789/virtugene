import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('virtugene', {
  key: {
    validate: (apiKey: string) => ipcRenderer.invoke('key:validate', { apiKey }),
  },
  chat: {
    send: (params: unknown) => ipcRenderer.invoke('chat:send', params),
  },
  character: {
    generate: (params: {
      apiKey: string;
      characterName: string;
      description: string;
      enableWebSearch: boolean;
      documentContext?: string;
    }, onProgress?: (step: string, message: string) => void) => {
      let cleanup: (() => void) | null = null;
      if (onProgress) {
        const handler = (_event: Electron.IpcRendererEvent, data: { step: string; message: string }) => {
          onProgress(data.step, data.message);
        };
        ipcRenderer.on('character:generate:progress', handler);
        cleanup = () => ipcRenderer.removeListener('character:generate:progress', handler);
      }
      return ipcRenderer.invoke('character:generate', params).finally(() => cleanup?.());
    },
  },
  file: {
    parse: (file: File) => {
      const filePath = webUtils.getPathForFile(file);
      return ipcRenderer.invoke('file:parse', { filePath });
    },
    parserReady: () => ipcRenderer.invoke('file:parserReady'),
    downloadParser: () => ipcRenderer.invoke('file:downloadParser'),
  },
  proactive: {
    generate: (params: {
      apiKey: string;
      systemPrompt: string;
      characterName: string;
      lastMessages: { role: string; content: string }[];
      affinity?: number;
      mood?: number;
    }) => ipcRenderer.invoke('proactive:generate', params),
  },
  memory: {
    extract: (params: {
      apiKey: string;
      history: { role: string; content: string }[];
    }) => ipcRenderer.invoke('memory:extract', params),
  },
  emotion: {
    analyze: (params: {
      apiKey: string;
      history: { role: string; content: string }[];
      characterName: string;
    }) => ipcRenderer.invoke('emotion:analyze', params),
  },
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onStatus: (callback: (status: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, status: unknown) => callback(status);
      ipcRenderer.on('update:status', handler);
      return () => ipcRenderer.removeListener('update:status', handler);
    },
  },
  shell: {
    open: (url: string) => ipcRenderer.invoke('shell:open', { url }),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    setSize: (width: number, height: number) => ipcRenderer.invoke('window:setSize', { width, height }),
  },
});
