import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { edgeTTSSpeak } from './edge-tts';
import { ensureModel, isModelInstalled, localSynth, modelsDir, modelSizeMB, removeModel } from './local-tts';

/**
 * 语音（TTS）服务 · 混合引擎：
 * 1. Edge-TTS（走代理，音色最好）→ 失败（代理未开/断网）时
 * 2. 本地 sherpa-onnx（离线，免代理）→ 失败时
 * 3. 返回错误（渲染层回退系统语音）
 *
 * 音频缓存放 D 盘（D:\VirtuGeneCache\tts）；模型放 D:\VirtuGeneModels。
 * 绝不主动播放：只在用户点击 🔊 时合成。
 */

export interface TTSParams {
  text: string;
  /** Edge-TTS 音色名 */
  voice: string;
  /** 本地离线音色编号（fanchen-C 0~186）；Edge 引擎忽略 */
  sid?: number;
  /** 语速：'+10%' / '-10%' */
  rate?: string;
  /** 音调：'+8Hz' / '-8Hz' */
  pitch?: string;
}

/** D 盘缓存根目录（优先），回退 C 盘 userData */
export function ttsCacheDir(): string {
  const d = 'D:\\VirtuGeneCache\\tts';
  try {
    if (fs.existsSync('D:\\')) {
      fs.mkdirSync(d, { recursive: true });
      return d;
    }
  } catch {
    /* ignore */
  }
  const { app } = require('electron') as typeof import('electron');
  const fallback = path.join(app.getPath('userData'), 'tts-cache');
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

function cacheKey(p: TTSParams): string {
  return crypto.createHash('sha1').update(JSON.stringify({ text: p.text, voice: p.voice, sid: p.sid ?? 0, rate: p.rate, pitch: p.pitch })).digest('hex');
}

/** 合成：Edge → 本地 → 失败 */
export async function synthesize(p: TTSParams): Promise<{ ok: true; audio: Buffer; engine: 'edge' | 'local' } | { ok: false; error: string }> {
  try {
    const dir = ttsCacheDir();
    const file = path.join(dir, `${cacheKey(p)}.mp3`);
    if (fs.existsSync(file)) {
      const buf = fs.readFileSync(file);
      // WAV（本地引擎产物）以 RIFF 开头，MP3（Edge 产物）以 0xFF 开头
      const engine: 'edge' | 'local' = buf.length > 4 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 ? 'local' : 'edge';
      return { ok: true, audio: buf, engine };
    }

    // 1) Edge（需代理）
    try {
      const buf = await edgeTTSSpeak(p.text, { voice: p.voice, rate: p.rate ?? '+0%', pitch: p.pitch ?? '+0Hz' });
      fs.writeFileSync(file, buf);
      return { ok: true, audio: buf, engine: 'edge' };
    } catch (edgeErr) {
      // 2) 本地离线（免代理）
      const rateNum = parseFloat(p.rate ?? '+0%') || 0;
      const speed = Math.max(0.6, Math.min(1.6, 1 + rateNum / 100));
      const local = await localSynth(p.text, speed, p.sid ?? 0);
      if (local) {
        fs.writeFileSync(file, local);
        return { ok: true, audio: local, engine: 'local' };
      }
      // 3) 都失败
      const msg = String((edgeErr as Error)?.message ?? edgeErr);
      const is403 = /403|Unexpected server response/i.test(msg);
      return {
        ok: false,
        error: is403
          ? '联网语音不可用（需代理），且本地语音模型未安装——请到设置下载离线语音模型，或开启代理'
          : '语音合成失败，请检查网络/代理或安装离线语音模型',
      };
    }
  } catch (err) {
    return { ok: false, error: `语音合成失败：${(err as Error)?.message ?? err}` };
  }
}

export function clearTtsCache(): { ok: boolean; freed?: string } {
  try {
    const dir = ttsCacheDir();
    let bytes = 0;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      bytes += fs.statSync(p).size;
      fs.unlinkSync(p);
    }
    return { ok: true, freed: `${(bytes / 1024 / 1024).toFixed(1)} MB` };
  } catch (err) {
    return { ok: false };
  }
}

export function registerTTSIPC() {
  ipcMain.handle('tts:synth', async (_e, p: TTSParams) => {
    if (!p?.text?.trim()) return { ok: false, error: '文本为空' };
    const text = p.text.trim().slice(0, 800);
    const r = await synthesize({ ...p, text });
    if (!r.ok) return r;
    return { ok: true, audio: r.audio.toString('base64'), engine: r.engine, filePath: null };
  });

  ipcMain.handle('tts:cacheDir', () => ({ dir: ttsCacheDir() }));
  ipcMain.handle('tts:clearCache', () => clearTtsCache());

  // 本地语音模型管理
  ipcMain.handle('tts:modelStatus', () => ({
    installed: isModelInstalled(),
    sizeMB: modelSizeMB(),
    dir: modelsDir(),
  }));
  ipcMain.handle('tts:modelDownload', async () => {
    const r = await ensureModel();
    return r;
  });
  ipcMain.handle('tts:modelRemove', () => removeModel());
}
