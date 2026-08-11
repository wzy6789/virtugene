import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const mainConfig = {
  entryPoints: ['electron/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist-electron/main.js',
  external: ['electron'],
};

/** @type {esbuild.BuildOptions} */
const preloadConfig = {
  entryPoints: ['electron/preload.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist-electron/preload.js',
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
