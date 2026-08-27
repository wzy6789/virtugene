import fs from 'fs';
import path from 'path';
import https from 'https';
import { execFileSync } from 'child_process';
import os from 'os';

/**
 * 本地离线 TTS（sherpa-onnx）：
 * - 模型下载到 D 盘（D:\VirtuGeneModels），不占 C 盘
 * - 完全离线、免代理、免费
 * - 默认模型：vits-zh-hf-fanchen-C（标准 VITS，116MB，187 个中文音色，sherpa 官方支持）
 */

export const LOCAL_MODEL_NAME = 'vits-zh-hf-fanchen-C';
const MODEL_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-zh-hf-fanchen-C.tar.bz2';

/** 模型根目录：优先 D 盘，回退 userData */
export function modelsDir(): string {
  try {
    if (fs.existsSync('D:\\')) {
      const d = 'D:\\VirtuGeneModels';
      fs.mkdirSync(d, { recursive: true });
      return d;
    }
  } catch {
    /* ignore */
  }
  const { app } = require('electron') as typeof import('electron');
  const fallback = path.join(app.getPath('userData'), 'models');
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

export function modelDir(): string {
  return path.join(modelsDir(), LOCAL_MODEL_NAME);
}

export function isModelInstalled(): boolean {
  const dir = modelDir();
  return fs.existsSync(path.join(dir, 'model.onnx')) || fs.existsSync(path.join(dir, `${LOCAL_MODEL_NAME}.onnx`));
}

/** 下载进度：返回 bytes/total（total 可能未知） */
type ProgressFn = (done: number, total: number | null) => void;

function download(url: string, dest: string, onProgress?: ProgressFn): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(url, { headers: { 'User-Agent': 'curl/8', Accept: '*/*' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307 || res.statusCode === 308) {
        const loc = res.headers.location;
        if (loc) {
          file.close();
          fs.unlinkSync(dest);
          download(new URL(loc, url).toString(), dest, onProgress).then(resolve).catch(reject);
          return;
        }
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`下载失败 HTTP ${res.statusCode}`));
        return;
      }
      const total = Number(res.headers['content-length'] ?? 0) || null;
      let done = 0;
      res.on('data', (c) => {
        done += c.length;
        onProgress?.(done, total);
      });
      res.pipe(file);
    });
    req.on('error', (e) => {
      file.close();
      try { fs.unlinkSync(dest); } catch {}
      reject(e);
    });
    file.on('finish', () => file.close(() => resolve()));
    file.on('error', (e) => {
      try { fs.unlinkSync(dest); } catch {}
      reject(e);
    });
  });
}

/** 解压 .tar.bz2（Windows 用系统 tar，其内置 bzip2 支持） */
function extractTarBz2(tarPath: string, destDir: string): void {
  execFileSync('tar', ['xf', tarPath, '-C', destDir], { stdio: 'pipe' });
}

/** 下载并解压模型（幂等） */
export async function ensureModel(onProgress?: ProgressFn): Promise<{ ok: boolean; error?: string }> {
  try {
    if (isModelInstalled()) return { ok: true };
    const root = modelsDir();
    const tmp = path.join(root, `${LOCAL_MODEL_NAME}.tar.bz2`);
    if (!fs.existsSync(tmp)) {
      await download(MODEL_URL, tmp, onProgress);
    }
    extractTarBz2(tmp, root);
    try { fs.unlinkSync(tmp); } catch {}
    if (!isModelInstalled()) return { ok: false, error: '模型解压后缺失，请重试' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `模型下载失败：${(err as Error)?.message ?? err}` };
  }
}

/** 删除模型（设置面板可清理，释放 D 盘空间） */
export function removeModel(): { ok: boolean } {
  try {
    invalidateTtsCache();
    fs.rmSync(modelDir(), { recursive: true, force: true });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** 模型占用空间（MB） */
export function modelSizeMB(): number {
  try {
    const dir = modelDir();
    if (!fs.existsSync(dir)) return 0;
    let total = 0;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isFile()) total += fs.statSync(p).size;
    }
    return Math.round(total / 1024 / 1024);
  } catch {
    return 0;
  }
}

/** 用本地模型合成语音（离线）：返回 WAV buffer；模型未装/失败返回 null */
export async function localSynth(text: string, speed = 1.0, sid = 0): Promise<Buffer | null> {
  try {
    if (!isModelInstalled()) return null;
    const tts = await getTtsInstance();
    if (!tts) return null;
    // Electron 下必须禁用外部 buffer，否则报 "External buffers are not allowed"
    // fanchen-C 共 187 个音色（sid 0~186），角色声线由 AI 判定后传入
    const safeSid = Number.isInteger(sid) ? Math.max(0, Math.min(186, sid)) : 0;
    // 与主进程 tts:synth 的 800 字上限保持一致，避免长消息本地合成被截断
    const audio = tts.generate({ text: text.slice(0, 800), sid: safeSid, speed, enableExternalBuffer: false });
    return wavFromSamples(audio.samples, audio.sampleRate);
  } catch {
    return null;
  }
}

interface CachedTts {
  tts: {
    generate: (o: { text: string; sid: number; speed: number; enableExternalBuffer: boolean }) => { samples: Float32Array; sampleRate: number };
    close?: () => void;
  };
  modelFile: string;
}

let cachedTts: CachedTts | null = null;

/** 获取复用的 OfflineTts 实例（模型只加载一次，大幅降低合成延迟） */
async function getTtsInstance(): Promise<CachedTts['tts'] | null> {
  const { createRequire } = await import('node:module');
  const appRoot = process.env.APP_ROOT ?? path.resolve(__dirname, '..');
  const req = createRequire(path.join(appRoot, 'index.js'));
  const { OfflineTts } = req('sherpa-onnx-node') as typeof import('sherpa-onnx-node');
  const dir = modelDir();
  // 模型文件可能叫 model.onnx 或 <name>.onnx
  const modelFile = ['model.onnx', `${LOCAL_MODEL_NAME}.onnx`].map((n) => path.join(dir, n)).find((p) => fs.existsSync(p));
  if (!modelFile) return null;
  if (cachedTts && cachedTts.modelFile === modelFile) return cachedTts.tts;
  cachedTts?.tts.close?.();
  const tts = new OfflineTts({
    model: {
      vits: {
        model: modelFile,
        lexicon: path.join(dir, 'lexicon.txt'),
        tokens: path.join(dir, 'tokens.txt'),
      },
      numThreads: os.cpus().length > 2 ? 2 : 1,
      debug: false,
    },
  });
  cachedTts = { tts, modelFile };
  return tts;
}

/** 模型删除时失效缓存，避免持有已删除文件句柄 */
export function invalidateTtsCache(): void {
  try {
    cachedTts?.tts.close?.();
  } catch {
    /* ignore */
  }
  cachedTts = null;
}

/** Float32Array → 16-bit WAV Buffer */
function wavFromSamples(samples: Float32Array, sampleRate: number): Buffer {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);      // fmt chunk size
  buf.writeUInt16LE(1, 20);       // PCM
  buf.writeUInt16LE(1, 22);       // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}
