/// <reference types="vite/client" />

interface VirtuGeneAPI {
  key: {
    validate: (apiKey: string) => Promise<{ valid: boolean; error?: string }>;
  };
  chat: {
    stream: (params: unknown) => Promise<void>;
    stop: (streamId: string) => void;
  };
  shell: {
    open: (url: string) => Promise<boolean>;
  };
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
}

declare global {
  interface Window {
    virtugene: VirtuGeneAPI;
  }
}
