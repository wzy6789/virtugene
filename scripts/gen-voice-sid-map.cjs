/**
 * 为 18 个 Edge 音色分配专属本地 sid 池（每个 3~4 个，尽量不重复）。
 * 依据：band（男女音域）+ bright（亮度槽）→ 每个音色的候选池；
 * 贪心分配：先处理候选池小的音色，优先用未分配的 sid，保证音色间声音不同。
 * 读取：dist-electron/local-voice-measure.json + local-timbre-measure.json
 * 输出：src/lib/voice-sid-map.ts
 */
const fs = require('fs');
const f0Data = JSON.parse(fs.readFileSync('dist-electron/local-voice-measure.json', 'utf8'));
const timbre = JSON.parse(fs.readFileSync('dist-electron/local-timbre-measure.json', 'utf8'));
const centMap = {};
for (const t of timbre) centMap[t.sid] = t.centroid;

const bands = [
  { band: 'male-deep', label: '低沉威严', min: 0, max: 119 },
  { band: 'male-mature', label: '沉稳磁性', min: 120, max: 149 },
  { band: 'male-young', label: '阳光清朗', min: 150, max: 174 },
  { band: 'female-soft', label: '温柔知性', min: 175, max: 209 },
  { band: 'female-bright', label: '甜美活泼', min: 210, max: 239 },
  { band: 'female-clear', label: '清亮灵动', min: 240, max: 999 },
];
const bandInfo = {};
for (const b of bands) {
  const sids = f0Data.filter((r) => r.f0 != null && r.f0 >= b.min && r.f0 <= b.max).map((r) => r.sid);
  const withCent = sids
    .map((sid) => ({ sid, cent: centMap[sid] ?? 0 }))
    .filter((x) => x.cent > 0)
    .sort((a, c) => a.cent - c.cent);
  const third = Math.max(1, Math.floor(withCent.length / 3));
  bandInfo[b.band] = {
    sids,
    dark: withCent.slice(0, third).map((x) => x.sid),
    bright: withCent.slice(-third).map((x) => x.sid),
  };
}

// 18 个音色 → band + bright（与 src/lib/voice-map.ts 的 EDGE_VOICE_TO_SLOT 保持一致）
const VOICES = [
  ['zh-CN-XiaoxiaoNeural', 'female-soft', 1],
  ['zh-CN-XiaoyiNeural', 'female-bright', 2],
  ['zh-CN-XiaoyouNeural', 'female-bright', 2],
  ['zh-CN-XiaohanNeural', 'female-soft', 1],
  ['zh-CN-XiaoxuanNeural', 'female-soft', 0],
  ['zh-CN-XiaomengNeural', 'female-soft', 0],
  ['zh-CN-XiaoruiNeural', 'female-soft', 2],
  ['zh-CN-XiaomoNeural', 'female-soft', 2],
  ['zh-CN-XiaoguiNeural', 'female-bright', 2],
  ['zh-CN-XiaozhenNeural', 'female-clear', 2],
  ['zh-CN-YunxiNeural', 'male-young', 2],
  ['zh-CN-YunyangNeural', 'male-mature', 1],
  ['zh-CN-YunjianNeural', 'male-deep', 0],
  ['zh-CN-YunxiaNeural', 'male-young', 1],
  ['zh-CN-YunhaoNeural', 'male-mature', 2],
  ['zh-CN-YunfengNeural', 'male-mature', 0],
  ['zh-CN-YunzeNeural', 'male-mature', 1],
  ['zh-CN-YunfanNeural', 'male-young', 2],
];

const assigned = new Set();
function poolFor(band, bright) {
  const info = bandInfo[band];
  return bright === 0 ? info.dark : bright === 2 ? info.bright : info.sids;
}
function alloc(voice, band, bright, count) {
  const info = bandInfo[band];
  const prefer = poolFor(band, bright);
  const out = [];
  const take = (arr) => {
    for (const s of arr) {
      if (out.length >= count) break;
      if (!assigned.has(s) && !out.includes(s)) {
        out.push(s);
        assigned.add(s);
      }
    }
  };
  take(prefer); // 优先自己亮度槽的未分配 sid
  take(info.sids); // 再从全档补充
  if (out.length < count) {
    // 兜底：允许复用（只在自己槽内）
    for (const s of prefer) {
      if (out.length >= count) break;
      if (!out.includes(s)) out.push(s);
    }
  }
  return out;
}

// 按候选池大小升序处理（池小的先拿，避免被抢）
const ordered = [...VOICES].sort((a, b) => poolFor(a[1], a[2]).length - poolFor(b[1], b[2]).length);
const map = {};
for (const [voice, band, bright] of ordered) {
  const want = band === 'female-clear' ? 3 : 4;
  map[voice] = alloc(voice, band, bright, want);
}

const lines = [];
lines.push('/**');
lines.push(' * Edge 音色 → 本地专属 sid 池（自动生成，勿手改）：');
lines.push(' * 每个音色独占 3~4 个本地音色编号，保证不同性格词的离线声音互不相同；');
lines.push(' * 生成脚本：scripts/gen-voice-sid-map.cjs');
lines.push(' */');
lines.push("export const VOICE_SID_MAP: Record<string, number[]> = {");
for (const [voice] of VOICES) {
  lines.push(`  '${voice}': [${map[voice].join(',')}],`);
}
lines.push('};');
fs.writeFileSync('src/lib/voice-sid-map.ts', lines.join('\n') + '\n');
console.log('written src/lib/voice-sid-map.ts');

// 摘要与冲突检查
const all = [];
for (const [voice] of VOICES) all.push(...map[voice]);
const dup = all.filter((s, i) => all.indexOf(s) !== i);
console.log(`共分配 ${all.length} 个 sid（去重 ${new Set(all).size}），跨音色重复：${new Set(dup).size} 个`);
for (const [voice, band, bright] of VOICES) {
  console.log(`  ${voice.replace(/^zh-CN-/, '').replace(/Neural$/, '')} → ${band}/${bright}: [${map[voice].join(',')}]`);
}
