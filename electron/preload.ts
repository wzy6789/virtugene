import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('virtugene', {
  key: {
    validate: (apiKey: string) => ipcRenderer.invoke('key:validate', { apiKey }),
  },
  chat: {
    stream: (params: unknown) => ipcRenderer.invoke('chat:stream', params),
    stop: (streamId: string) => ipcRenderer.send('chat:stop', { streamId }),
  },
  shell: {
    open: (url: string) => ipcRenderer.invoke('shell:open', { url }),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
});
