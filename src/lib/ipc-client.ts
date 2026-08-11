/**
 * Renderer-side IPC wrapper.
 * Falls back gracefully when running in browser (dev without Electron).
 */

const noop = {
  key: {
    validate: async () => ({ valid: false, error: '未在 Electron 环境中运行' }),
  },
  chat: {
    stream: async () => {},
    stop: () => {},
  },
  shell: {
    open: async () => false,
  },
  window: {
    minimize: () => {},
    maximize: () => {},
    close: () => {},
  },
};

export const ipc = window.virtugene ?? noop;
