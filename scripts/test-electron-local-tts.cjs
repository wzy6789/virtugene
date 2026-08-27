/**
 * Electron 环境下验证本地 TTS（sherpa-onnx addon 是否能被 Electron 加载）
 * 用法：electron scripts/test-electron-local-tts.cjs
 */
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

process.env.APP_ROOT = path.resolve(__dirname, '..');

app.whenReady().then(async () => {
  try {
    const { createRequire } = require('module');
    const req = createRequire(path.join(process.env.APP_ROOT, 'index.js'));
    console.log('APP_ROOT:', process.env.APP_ROOT);
    // 1) 测试 createRequire 能否解析 sherpa-onnx-node
    const mod = req('sherpa-onnx-node');
    console.log('sherpa-onnx-node 加载 OK, keys:', Object.keys(mod).slice(0, 5).join(','));
    const { OfflineTts } = mod;

    // 2) 本地合成
    const dir = 'D:/VirtuGeneModels/vits-zh-hf-fanchen-C';
    const modelFile = fs.existsSync(path.join(dir, 'model.onnx'))
      ? path.join(dir, 'model.onnx')
      : path.join(dir, 'vits-zh-hf-fanchen-C.onnx');
    console.log('model file:', modelFile, '| exists:', fs.existsSync(modelFile));

    const tts = new OfflineTts({
      model: {
        vits: {
          model: modelFile,
          lexicon: path.join(dir, 'lexicon.txt'),
          tokens: path.join(dir, 'tokens.txt'),
        },
        numThreads: 2,
        debug: false,
      },
    });
    const audio = tts.generate({ text: '你好，这是 Electron 里的离线语音测试。', sid: 0, speed: 1.0, enableExternalBuffer: false });
    console.log('离线合成成功:', audio.sampleRate, 'Hz,', audio.samples.length, 'samples');
    tts.close?.();
  } catch (e) {
    console.error('失败:', e.message || e);
    console.error(e.stack?.split('\n').slice(0, 4).join('\n'));
  }
  app.quit();
});
