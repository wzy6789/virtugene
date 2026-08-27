/**
 * 生成本地音色画像表：男女分档用 4kHz F0（权威），档内亮度细分用 centroid（光谱重心）。
 * 读取：dist-electron/local-voice-measure.json（f0）+ dist-electron/local-timbre-measure.json（centroid）
 * 输出：src/lib/local-voice-bands.ts
 */
const fs = require('fs');
const f0Data = JSON.parse(fs.readFileSync('dist-electron/local-voice-measure.json', 'utf8'));
const timbre = JSON.parse(fs.readFileSync('dist-electron/local-timbre-measure.json', 'utf8'));
const centMap = {};
for (const t of timbre) centMap[t.sid] = t.centroid;

const bands = [
  { band: 'male-deep', label: '低沉威严', vibe: '厚重、低沉、有压迫感', min: 0, max: 119 },
  { band: 'male-mature', label: '沉稳磁性', vibe: '磁性、成熟、可靠', min: 120, max: 149 },
  { band: 'male-young', label: '阳光清朗', vibe: '年轻、清朗、有活力', min: 150, max: 174 },
  { band: 'female-soft', label: '温柔知性', vibe: '温柔、亲切、知性', min: 175, max: 209 },
  { band: 'female-bright', label: '甜美活泼', vibe: '甜美、元气、活泼', min: 210, max: 239 },
  { band: 'female-clear', label: '清亮灵动', vibe: '清亮、灵动、少女感', min: 240, max: 999 },
];

const lines = [];
lines.push('/**');
lines.push(' * 本地离线音色画像表（自动生成，勿手改）');
lines.push(' * 来源：vits-zh-hf-fanchen-C 的 187 个音色 —— F0(4kHz) 分男女音域档，');
lines.push(' * 光谱重心(centroid) 在档内再分 dark(柔和)/bright(明亮) 子集，让音色与性格词匹配；');
lines.push(' * 生成脚本：scripts/gen-voice-bands.cjs');
lines.push(' */');
lines.push("import type { VoiceBand } from './voice-map';");
lines.push('');
lines.push('export const LOCAL_VOICE_BANDS: { band: VoiceBand; label: string; vibe: string; sids: number[]; dark: number[]; bright: number[] }[] = [');
for (const b of bands) {
  const sids = f0Data.filter((r) => r.f0 != null && r.f0 >= b.min && r.f0 <= b.max).map((r) => r.sid);
  // 档内按 centroid 升序 → 前 1/3 暗（柔和），后 1/3 亮（明亮）
  const withCent = sids
    .map((sid) => ({ sid, cent: centMap[sid] ?? 0 }))
    .filter((x) => x.cent > 0)
    .sort((a, c) => a.cent - c.cent);
  const third = Math.max(1, Math.floor(withCent.length / 3));
  const dark = withCent.slice(0, third).map((x) => x.sid);
  const bright = withCent.slice(-third).map((x) => x.sid);
  lines.push(
    "  { band: '" + b.band + "', label: '" + b.label + "', vibe: '" + b.vibe + "', sids: [" + sids.join(',') + '], dark: [' + dark.join(',') + '], bright: [' + bright.join(',') + '] },',
  );
}
lines.push('];');
fs.writeFileSync('src/lib/local-voice-bands.ts', lines.join('\n') + '\n');
console.log('written src/lib/local-voice-bands.ts');

// 摘要
for (const b of bands) {
  const sids = f0Data.filter((r) => r.f0 != null && r.f0 >= b.min && r.f0 <= b.max).map((r) => r.sid);
  const withCent = sids
    .map((sid) => ({ sid, cent: centMap[sid] ?? 0 }))
    .filter((x) => x.cent > 0)
    .sort((a, c) => a.cent - c.cent);
  const third = Math.max(1, Math.floor(withCent.length / 3));
  console.log(`${b.band} (${b.label}): ${sids.length} sids | dark=${withCent.slice(0, third).length} bright=${withCent.slice(-third).length}`);
}
