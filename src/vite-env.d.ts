/// <reference types="vite/client" />

interface VirtuGeneAPI {
  key: {
    validate: (apiKey: string) => Promise<{ valid: boolean; error?: string }>;
  };
  chat: {
    send: (params: {
      apiKey: string;
      systemPrompt: string;
      message: string;
      history: { role: 'user' | 'assistant'; content: string }[];
    }) => Promise<{ content?: string; error?: string }>;
  };
  shell: {
    open: (url: string) => Promise<boolean>;
  };
  character: {
    generate: (
      params: {
        apiKey: string;
        characterName: string;
        description: string;
        enableWebSearch: boolean;
        documentContext?: string;
      },
      onProgress?: (step: string, message: string) => void,
    ) => Promise<{ content?: string; error?: string }>;
  };
  file: {
    parse: (file: File) => Promise<{ text?: string; error?: string }>;
  };
  proactive: {
    generate: (params: {
      apiKey: string;
      systemPrompt: string;
      characterName: string;
      lastMessages: { role: string; content: string }[];
      affinity?: number;
      mood?: number;
    }) => Promise<{ content?: string; error?: string }>;
  };
  memory: {
    extract: (params: {
      apiKey: string;
      history: { role: string; content: string }[];
    }) => Promise<{ memories?: string[]; error?: string }>;
  };
  emotion: {
    analyze: (params: {
      apiKey: string;
      history: { role: string; content: string }[];
      characterName: string;
    }) => Promise<{
      dimensions?: { valence: number; arousal: number; intimacy: number; engagement: number; expressiveness: number; stability: number };
      dominantEmotion?: string;
      summary?: string;
      error?: string;
    }>;
  };
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    setSize: (width: number, height: number) => Promise<boolean>;
  };
}

interface Window {
  virtugene: VirtuGeneAPI;
}
