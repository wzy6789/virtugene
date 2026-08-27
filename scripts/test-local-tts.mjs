/**
 * 本地 TTS 独立测试：验证离线合成（dev 模式）
 * 用法：node scripts/test-local-tts.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

process.env.APP_ROOT = process.cwd();
const req = createRequire(path.join(process.cwd(), 'index.js'));
const { OfflineTts } = req('sherpa-onnx-node');

const MODEL_DIR = path.join('D:\\VirtuGeneModels', 'vits-zh-hf-fanchen-C');
const modelFile = fs.existsSync(path.join(MODEL_DIR, 'model.onnx'))
  ? path.join(MODEL_DIR, 'model.onnx')
  : path.join(MODEL_DIR, 'vits-zh-hf-fanchen-C.onnx');

function wavFromSamples(samples, sampleRate) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

if (!fs.existsSync(modelFile)) {
  console.log('模型未安装:', modelFile);
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

// 测试不同音色（fanchen-C 有 187 个音色）
for (const sid of [0, 50, 186]) {
  const audio = tts.generate({ text: '你好，我是你的数字灵魂，很高兴认识你。', sid, speed: 1.0, enableExternalBuffer: false });
  console.log(`sid=${sid}: ${audio.sampleRate}Hz, ${audio.samples.length} samples (${(audio.samples.length / audio.sampleRate).toFixed(1)}s)`);
}
const audio = tts.generate({ text: '你好，我是你的数字灵魂，很高兴认识你。', sid: 0, speed: 1.0, enableExternalBuffer: false });
const wav = wavFromSamples(audio.samples, audio.sampleRate);
fs.writeFileSync('dist-electron/_test-local.wav', wav);
console.log('离线合成 OK → dist-electron/_test-local.wav', wav.length, 'bytes');
tts.close?.();
