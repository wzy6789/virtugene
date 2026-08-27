/**
 * 多音色验证（Electron 环境）：用不同档位的 sid 合成同一句话，
 * 确认本地引擎能按角色输出不同音色（不同 sid → 不同音频）。
 * 用法：node_modules\.bin\electron.cmd scripts/test-multi-voices.cjs
 */
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

process.env.APP_ROOT = path.resolve(__dirname, '..');
const req = require('module').createRequire(path.join(process.env.APP_ROOT, 'index.js'));

app.whenReady().then(async () => {
  try {
    const { OfflineTts } = req('sherpa-onnx-node');
    const dir = 'D:\\VirtuGeneModels\\vits-zh-hf-fanchen-C';
    const modelFile = fs.existsSync(path.join(dir, 'model.onnx'))
      ? path.join(dir, 'model.onnx')
      : path.join(dir, 'vits-zh-hf-fanchen-C.onnx');
    const tts = new OfflineTts({
      model: {
        vits: { model: modelFile, lexicon: path.join(dir, 'lexicon.txt'), tokens: path.join(dir, 'tokens.txt') },
        numThreads: 2,
        debug: false,
      },
    });
    const text = '你好，我是你的数字灵魂。';
    const sids = [1, 24, 50, 92, 0]; // 男低 / 极低 / 清亮女声 / 清亮女声 / 默认
    const sigs = [];
    for (const sid of sids) {
      const audio = tts.generate({ text, sid, speed: 1.0, enableExternalBuffer: false });
      // 用前 2000 个采样的简单指纹（和/或）对比
      let sum = 0;
      for (let i = 0; i < Math.min(2000, audio.samples.length); i++) sum += audio.samples[i];
      sigs.push(`sid=${sid}: ${audio.sampleRate}Hz, ${audio.samples.length}samples, sum=${sum.toFixed(3)}`);
    }
    tts.close?.();
    console.log('多音色合成完成：');
    for (const s of sigs) console.log(' ', s);
    console.log('不同 sid 的 sum 指纹不同 → 音色确实不同（若全部相同则异常）');
    app.exit(0);
  } catch (err) {
    console.error('失败:', err);
    app.exit(1);
  }
});
