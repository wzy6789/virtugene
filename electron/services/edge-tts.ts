import { MsEdgeTTS } from 'msedge-tts';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * Edge-TTS 语音合成（msedge-tts 库）：
 * - 已内置 Sec-MS-GEC token（解决 403）
 * - 支持 agent 走 Clash 代理（解决国内直连不通）
 */

export interface EdgeTTSOptions {
  voice: string;
  rate?: string;  // '+0%'
  pitch?: string; // '+0Hz'
}

/** 常用代理端口（Clash 默认 7897；依次尝试） */
const PROXY_CANDIDATES = ['http://127.0.0.1:7897', 'http://127.0.0.1:7890', 'http://127.0.0.1:10809'];

/** 探测哪个代理端口可用（TCP 快速连接测试） */
function findProxy(): string | undefined {
  const net = require('net') as typeof import('net');
  for (const url of PROXY_CANDIDATES) {
    const { hostname, port } = new URL(url);
    const ok = net.connectSync?.(Number(port), hostname);
    if (ok) {
      ok.destroy();
      return url;
    }
  }
  return undefined;
}

export async function edgeTTSSpeak(
  text: string,
  options: EdgeTTSOptions,
): Promise<Buffer> {
  const { voice, rate = '+0%', pitch = '+0Hz' } = options;
  const proxy = findProxy();
  const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;

  const tts = new MsEdgeTTS(agent ? { agent } : {});
  await tts.setMetadata(voice, 'audio-24khz-48kbitrate-mono-mp3');
  try {
    const { audioStream } = tts.toStream(text, { rate, pitch });
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) chunks.push(chunk as Buffer);
    if (chunks.length === 0) throw new Error('no audio');
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}

