/**
 * 本地音色画像测量：合成同一句话，用基频（F0）估计每个 sid 的音域（男/女声）。
 * 用法：node scripts/measure-local-voices.mjs
 * 输出：dist-electron/local-voice-measure.json（[{sid, f0, dur}]）
 * 说明：fanchen-C 的 187 个音色无元数据，F0 是唯一可自动获得的性别/音域信号。
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

process.env.APP_ROOT = process.cwd();
const req = createRequire(path.join(process.cwd(), 'index.js'));
const { OfflineTts } = req('sherpa-onnx-node');

const MODEL_DIR = path.join('D:\\VirtuGeneModels', 'vits-zh-hf-fanchen-C');
const modelFile = fs.existsSync(path.join(MODEL_DIR, 'model.onnx'))
  ? path.join(MODEL_DIR, 'model.onnx')
  : path.join(MODEL_DIR, 'vits-zh-hf-fanchen-C.onnx');

const TEXT = '你好，很高兴认识你。';
const F0_MIN = 70;   // Hz
const F0_MAX = 350;  // Hz

/** 降采样：16kHz → 4kHz（F0≤350Hz 足够） */
function downsample(samples, factor) {
  const out = new Float32Array(Math.floor(samples.length / factor));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (let j = 0; j < factor; j++) sum += samples[i * factor + j];
    out[i] = sum / factor;
  }
  return out;
}

/** 自相关 F0 估计，返回帧级基频中位数（Hz） */
function estimateF0(samples, sampleRate) {
  const ds = downsample(samples, Math.max(1, Math.round(sampleRate / 4000)));
  const sr = sampleRate / Math.max(1, Math.round(sampleRate / 4000));
  const frameLen = Math.floor(sr * 0.02);   // 20ms
  const frameShift = Math.floor(sr * 0.01); // 10ms
  const minLag = Math.max(2, Math.floor(sr / F0_MAX));
  const maxLag = Math.floor(sr / F0_MIN);
  const f0s = [];
  for (let start = 0; start + frameLen < ds.length; start += frameShift) {
    let mean = 0;
    for (let i = 0; i < frameLen; i++) mean += ds[start + i];
    mean /= frameLen;
    let energy = 0;
    for (let i = 0; i < frameLen; i++) {
      const d = ds[start + i] - mean;
      energy += d * d;
    }
    if (energy < 1e-5) continue; // 静音帧
    let bestLag = -1;
    let bestScore = -1;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let num = 0;
      let den = 0;
      for (let i = 0; i + lag < frameLen; i++) {
        const a = ds[start + i] - mean;
        const b = ds[start + i + lag] - mean;
        num += a * b;
        den += a * a;
      }
      if (den <= 0) continue;
      const score = num / den;
      if (score > bestScore) {
        bestScore = score;
        bestLag = lag;
      }
    }
    // 需要足够的周期性才视为 voiced
    if (bestScore > 0.45 && bestLag > 0) {
      f0s.push(sr / bestLag);
    }
  }
  if (f0s.length < 3) return null;
  f0s.sort((a, b) => a - b);
  // 用中位数，去除异常帧影响
  return Math.round(f0s[Math.floor(f0s.length / 2)]);
}

if (!fs.existsSync(modelFile)) {
  console.error('模型未安装:', modelFile);
  process.exit(1);
}

const tts = new OfflineTts({
  model: {
    vits: {
      model: modelFile,
      lexicon: path.join(MODEL_DIR, 'lexicon.txt'),
      tokens: path.join(MODEL_DIR, 'tokens.txt'),
    },
    numThreads: os.cpus().length > 2 ? 2 : 1,
    debug: false,
  },
});

const results = [];
const total = 187;
for (let sid = 0; sid < total; sid++) {
  const t0 = Date.now();
  const audio = tts.generate({ text: TEXT, sid, speed: 1.0, enableExternalBuffer: false });
  const f0 = estimateF0(audio.samples, audio.sampleRate);
  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  results.push({ sid, f0, durS: audio.samples.length / audio.sampleRate });
  console.log(`sid=${sid}: f0=${f0 ?? 'n/a'}Hz gen=${dur}s`);
}
tts.close?.();

fs.mkdirSync('dist-electron', { recursive: true });
const out = path.join('dist-electron', 'local-voice-measure.json');
fs.writeFileSync(out, JSON.stringify(results, null, 1));
console.log(`\n完成：${results.length} 个音色 → ${out}`);
const withF0 = results.filter((r) => r.f0 != null);
console.log(`有 F0 的音色：${withF0.length}/${results.length}`);
