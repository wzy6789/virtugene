/**
 * 打包产物验证：模拟打包后运行时的加载路径（APP_ROOT = app.asar），
 * 验证 createRequire 能从 asar 解析 sherpa-onnx-node 且 .node 自动重定向到 app.asar.unpacked。
 * 用法：node_modules\.bin\electron.cmd scripts/test-packaged-tts.cjs
 */
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_ASAR = path.resolve(__dirname, '..', 'release', 'win-unpacked', 'resources', 'app.asar');
if (!fs.existsSync(APP_ASAR)) {
  console.error('未找到 app.asar:', APP_ASAR);
  process.exit(1);
}
process.env.APP_ROOT = APP_ASAR;

app.whenReady().then(async () => {
  try {
    const req = require('module').createRequire(path.join(APP_ASAR, 'index.js'));
    const { OfflineTts } = req('sherpa-onnx-node');
    console.log('✅ addon 从 asar 加载 OK（.node 重定向到 app.asar.unpacked）');
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
    const audio = tts.generate({ text: '你好，这是打包后的离线语音测试。', sid: 0, speed: 1.0, enableExternalBuffer: false });
    console.log('✅ 打包后离线合成成功:', audio.sampleRate, 'Hz,', audio.samples.length, 'samples');
    tts.close?.();
    app.exit(0);
  } catch (err) {
    console.error('❌ 失败:', err);
    app.exit(1);
  }
});
