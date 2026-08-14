import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['scripts/parser-entry.js'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'release/parser.cjs',
  external: ['@napi-rs/canvas'],
});

console.log('parser bundle — done');
