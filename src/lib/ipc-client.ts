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
  shell: {
    open: async () => false,
  },
  window: {
    minimize: () => {},
    maximize: () => {},
    close: () => {},
    setSize: async () => false,
  },
};

export const ipc: VirtuGeneAPI = window.virtugene ?? noop;
