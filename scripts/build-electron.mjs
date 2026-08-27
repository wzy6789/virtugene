import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const mainConfig = {
  entryPoints: ['electron/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist-electron/main.cjs',
  external: [
    'electron',
    // 原生 addon（.node）无法 bundle，运行时从 node_modules 加载
    'sherpa-onnx-node',
    'sherpa-onnx-win-x64',
  ],
};

/** @type {esbuild.BuildOptions} */
const preloadConfig = {
  entryPoints: ['electron/preload.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist-electron/preload.cjs',
  external: ['electron'],
};

if (isWatch) {
  const mainCtx = await esbuild.context(mainConfig);
  const preloadCtx = await esbuild.context(preloadConfig);
  await Promise.all([mainCtx.watch(), preloadCtx.watch()]);
  console.log('electron build — watching...');
} else {
  await esbuild.build(mainConfig);
  await esbuild.build(preloadConfig);
  console.log('electron build — done');
}
