const noop: VirtuGeneAPI = {
  key: {
    validate: async () => ({ valid: false, error: '未在 Electron 环境中运行' }),
  },
  chat: {
    send: async () => ({ error: '未在 Electron 环境中运行' }),
  },
  character: {
    generate: async () => ({ error: '未在 Electron 环境中运行' }),
  },
  file: {
    parse: async () => ({ error: '未在 Electron 环境中运行' }),
    parserReady: async () => ({ ready: false }),
    downloadParser: async () => ({ error: '未在 Electron 环境中运行' }),
  },
  proactive: {
    generate: async () => ({ error: '未在 Electron 环境中运行' }),
  },
  memory: {
    extract: async () => ({ error: '未在 Electron 环境中运行' }),
  },
  emotion: {
    analyze: async () => ({ error: '未在 Electron 环境中运行' }),
  },
  context: {
    settle: async () => ({ error: '未在 Electron 环境中运行' }),
    summarize: async () => ({ error: '未在 Electron 环境中运行' }),
  },
  diary: {
    assist: async () => ({ error: '未在 Electron 环境中运行' }),
    exportTxt: async () => ({ ok: false }),
    exportDocx: async () => ({ ok: false }),
    exportPdf: async () => ({ ok: false }),
    exportJson: async () => ({ ok: false }),
    importJson: async () => ({ ok: false }),
    exportMarkdown: async () => ({ ok: false }),
  },
  shell: {
    open: async () => false,
  },
  window: {
    minimize: () => {},
    maximize: () => {},
    close: () => {},
    setSize: async () => false,
  },
  app: {
    getVersion: async () => '',
    notify: async () => false,
  },
  clipboard: {
    writeText: async () => false,
  },
  update: {
    check: async () => ({ error: '未在 Electron 环境中运行' }),
    download: async () => ({ error: '未在 Electron 环境中运行' }),
    install: async () => ({ error: '未在 Electron 环境中运行' }),
    onStatus: () => () => {},
  },
};

export const ipc: VirtuGeneAPI = window.virtugene ?? noop;
