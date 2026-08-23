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
      fields: {
        description?: string;
        identity?: string;
        personality?: string;
        speechStyle?: string;
        speechExamples?: string;
        supplement?: string;
      };
      enableWebSearch: boolean;
      documentContext?: string;
      count?: number;
    }, onProgress?: (step: string, message: string, progress: number) => void) => {
      let cleanup: (() => void) | null = null;
      if (onProgress) {
        const handler = (_event: Electron.IpcRendererEvent, data: { step: string; message: string; progress: number }) => {
          onProgress(data.step, data.message, data.progress);
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
      lastMessageAt?: number;
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
  context: {
    settle: (params: {
      apiKey: string;
      history: { role: string; content: string }[];
      characterName: string;
    }) => ipcRenderer.invoke('context:settle', params),
    summarize: (params: {
      apiKey: string;
      history: { role: string; content: string }[];
    }) => ipcRenderer.invoke('context:summarize', params),
  },
  diary: {
    assist: (params: {
      apiKey: string;
      mode: 'polish' | 'continue' | 'extract' | 'guide' | 'auto' | 'compile' | 'combine' | 'review' | 'annual';
      text: string;
      context?: string;
    }) => ipcRenderer.invoke('diary:assist', params),
    exportTxt: (entries: { title: string; date: string; content: string }[]) =>
      ipcRenderer.invoke('diary:exportTxt', { entries }),
    exportDocx: (entries: { title: string; date: string; content: string }[]) =>
      ipcRenderer.invoke('diary:exportDocx', { entries }),
    exportPdf: (html: string) => ipcRenderer.invoke('diary:exportPdf', { html }),
    exportJson: (diaries: unknown[]) => ipcRenderer.invoke('diary:exportJson', { diaries }),
    importJson: () => ipcRenderer.invoke('diary:importJson'),
    exportMarkdown: (diaries: { date: string; title: string; content: string; mood?: number; tags?: string[] }[]) =>
      ipcRenderer.invoke('diary:exportMarkdown', { diaries }),
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
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    notify: (title: string, body: string) => ipcRenderer.invoke('app:notify', { title, body }),
  },
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', { text }),
  },
});
