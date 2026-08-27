/**
 * 角色声线（TTS）：
 * - Edge 音色：AI 从 18 个知名中文音色池按角色形象挑选（首选引擎，需代理）
 * - 本地音色：**先分男女，再分性格**——AI 判定音域档位 band（6 档：
 *   低沉男声/沉稳男声/阳光男声/温柔女声/甜美女声/清亮女声），
 *   具体 sid 由 band + 角色 id 哈希确定（稳定、同档位内不同角色可分散）
 * - 每个角色创建/首次聊天时由 AI 判定声线并固定（存 Character.voice）
 * - 发声走 Edge-TTS（需代理）；失败自动回退本地 sherpa-onnx（离线，按 sid 多音色）
 */
import { LOCAL_VOICE_BANDS } from './local-voice-bands';
import { VOICE_SID_MAP } from './voice-sid-map';

export type VoiceBand = 'male-deep' | 'male-mature' | 'male-young' | 'female-soft' | 'female-bright' | 'female-clear';

/** 档位性别：男声档 vs 女声档（男女硬分，先于性格） */
export function bandGender(band: VoiceBand): 'male' | 'female' {
  return band.startsWith('male') ? 'male' : 'female';
}

export interface VoiceProfile {
  /** Edge-TTS 音色名，如 zh-CN-XiaoxiaoNeural */
  voice: string;
  /** 本地音色档位（AI 判定，先男女后性格） */
  band?: VoiceBand;
  /** 本地离线音色编号（fanchen-C 0~186），由 band + 角色 id 推导后落库固定 */
  sid?: number;
  /** 语速：'+10%' / '-10%' */
  rate: string;
  /** 音调：'+8Hz' / '-8Hz' */
  pitch: string;
}

/** 音色池（Edge-TTS 中文 18 个）：只标注性别与性格词，不取人名 */
export const VOICE_POOL: { voice: string; gender: 'male' | 'female'; vibe: string }[] = [
  { voice: 'zh-CN-XiaoxiaoNeural', gender: 'female', vibe: '温柔自然' },
  { voice: 'zh-CN-XiaoyiNeural', gender: 'female', vibe: '甜美活泼' },
  { voice: 'zh-CN-XiaoyouNeural', gender: 'female', vibe: '灵动俏皮' },
  { voice: 'zh-CN-XiaohanNeural', gender: 'female', vibe: '温暖亲切' },
  { voice: 'zh-CN-XiaoxuanNeural', gender: 'female', vibe: '柔和治愈' },
  { voice: 'zh-CN-XiaomengNeural', gender: 'female', vibe: '轻柔慵懒' },
  { voice: 'zh-CN-XiaoruiNeural', gender: 'female', vibe: '冷静知性' },
  { voice: 'zh-CN-XiaomoNeural', gender: 'female', vibe: '洒脱豪迈' },
  { voice: 'zh-CN-XiaoguiNeural', gender: 'female', vibe: '青涩稚嫩' },
  { voice: 'zh-CN-XiaozhenNeural', gender: 'female', vibe: '清亮干练' },
  { voice: 'zh-CN-YunxiNeural', gender: 'male', vibe: '阳光活力' },
  { voice: 'zh-CN-YunyangNeural', gender: 'male', vibe: '沉稳磁性' },
  { voice: 'zh-CN-YunjianNeural', gender: 'male', vibe: '低沉威严' },
  { voice: 'zh-CN-YunxiaNeural', gender: 'male', vibe: '清爽邻家' },
  { voice: 'zh-CN-YunhaoNeural', gender: 'male', vibe: '大气播音' },
  { voice: 'zh-CN-YunfengNeural', gender: 'male', vibe: '慵懒随性' },
  { voice: 'zh-CN-YunzeNeural', gender: 'male', vibe: '温柔暖男' },
  { voice: 'zh-CN-YunfanNeural', gender: 'male', vibe: '热血张扬' },
];

export const DEFAULT_VOICE: VoiceProfile = { voice: 'zh-CN-XiaoxiaoNeural', band: 'female-soft', sid: 0, rate: '+0%', pitch: '+0Hz' };

/** 本地离线音色档位（基频画像，测量自 vits-zh-hf-fanchen-C 的 187 个音色；见 local-voice-bands.ts） */
export { LOCAL_VOICE_BANDS };

/** djb2 稳定字符串哈希（同角色永远同结果） */
export function stableHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** 在音档内用 seed（角色 id）哈希选一个本地音色编号；无画像表时全量 0~186 哈希兜底 */
export function pickSidByBand(band: VoiceBand | undefined, seed: string): number {
  const list = LOCAL_VOICE_BANDS.find((b) => b.band === band)?.sids;
  if (list && list.length > 0) {
    return list[stableHash(seed) % list.length];
  }
  return stableHash(seed) % 187;
}

/** Edge 音色 → 本地档位 + 亮度槽（bright: 0=柔和(dark) 1=默认 2=明亮(bright)），让本地声音与性格词匹配 */
export const EDGE_VOICE_TO_SLOT: Record<string, { band: VoiceBand; bright: 0 | 1 | 2 }> = {
  // 女声
  'zh-CN-XiaoxiaoNeural': { band: 'female-soft', bright: 1 }, // 温柔自然
  'zh-CN-XiaoyiNeural': { band: 'female-bright', bright: 2 }, // 甜美活泼
  'zh-CN-XiaoyouNeural': { band: 'female-bright', bright: 2 }, // 灵动俏皮
  'zh-CN-XiaohanNeural': { band: 'female-soft', bright: 1 }, // 温暖亲切
  'zh-CN-XiaoxuanNeural': { band: 'female-soft', bright: 0 }, // 柔和治愈
  'zh-CN-XiaomengNeural': { band: 'female-soft', bright: 0 }, // 轻柔慵懒
  'zh-CN-XiaoruiNeural': { band: 'female-soft', bright: 2 }, // 冷静知性
  'zh-CN-XiaomoNeural': { band: 'female-soft', bright: 2 }, // 洒脱豪迈
  'zh-CN-XiaoguiNeural': { band: 'female-bright', bright: 2 }, // 青涩稚嫩
  'zh-CN-XiaozhenNeural': { band: 'female-clear', bright: 2 }, // 清亮干练
  // 男声
  'zh-CN-YunxiNeural': { band: 'male-young', bright: 2 }, // 阳光活力
  'zh-CN-YunyangNeural': { band: 'male-mature', bright: 1 }, // 沉稳磁性
  'zh-CN-YunjianNeural': { band: 'male-deep', bright: 0 }, // 低沉威严
  'zh-CN-YunxiaNeural': { band: 'male-young', bright: 1 }, // 清爽邻家
  'zh-CN-YunhaoNeural': { band: 'male-mature', bright: 2 }, // 大气播音
  'zh-CN-YunfengNeural': { band: 'male-mature', bright: 0 }, // 慵懒随性
  'zh-CN-YunzeNeural': { band: 'male-mature', bright: 1 }, // 温柔暖男
  'zh-CN-YunfanNeural': { band: 'male-young', bright: 2 }, // 热血张扬
};

/** 兼容：Edge 音色 → 档位 */
export function bandFromEdgeVoice(voice: string): VoiceBand {
  return EDGE_VOICE_TO_SLOT[voice]?.band ?? (/Yun/i.test(voice) ? 'male-mature' : 'female-soft');
}

/** 在音档的亮度槽内用 seed 哈希选本地音色编号（子集为空时回退全档） */
export function pickSidBySlot(band: VoiceBand, bright: 0 | 1 | 2, seed: string): number {
  const info = LOCAL_VOICE_BANDS.find((b) => b.band === band);
  if (!info) return stableHash(seed) % 187;
  const pool = bright === 0 ? info.dark : bright === 2 ? info.bright : info.sids;
  if (pool.length > 0) return pool[stableHash(seed) % pool.length];
  if (info.sids.length > 0) return info.sids[stableHash(seed) % info.sids.length];
  return stableHash(seed) % 187;
}

/** 主入口：按 Edge 音色的专属 sid 池选本地音色（保证不同性格词声音互不相同）；无池时回退档位+亮度槽 */
export function pickSidByVoice(edgeVoice: string, seed: string): number {
  const pool = VOICE_SID_MAP[edgeVoice];
  if (pool && pool.length > 0) return pool[stableHash(seed) % pool.length];
  const slot = EDGE_VOICE_TO_SLOT[edgeVoice];
  return pickSidBySlot(slot?.band ?? bandFromEdgeVoice(edgeVoice), slot?.bright ?? 1, seed);
}

/** 给 AI 的声线选择提示：先判定角色性别 → 再选性格气质档 → 选 Edge 音色 */
export const VOICE_SELECT_PROMPT =
  '你是一位声线设计师。为数字灵魂挑选声线时，**第一步先判断角色性别（男/女），第二步再根据性格气质选音域档位，第三步选 Edge 音色**。\n\n' +
  '本地音域档位（band，按男女分档，性别与角色必须一致）：\n' +
  LOCAL_VOICE_BANDS.map((b) => `- ${b.band}：${b.label}（${b.vibe}）`).join('\n') +
  '\n\n' +
  'Edge 音色池（voice 名 + 性别 + 性格）：\n' +
  VOICE_POOL.map((v) => `- ${v.voice}：${v.gender === 'female' ? '女' : '男'}声，${v.vibe}`).join('\n') +
  '\n\n' +
  '要求：\n' +
  '- 第一步必须明确角色性别；band 与 voice 的性别必须与角色一致，**绝不允许给男角色选女声、给女角色选男声**\n' +
  '- band 从上面 6 个档位中选择，先性别后气质：如男性长者/威严选 male-deep，青年男子选 male-mature 或 male-young；女性温柔选 female-soft，甜美少女选 female-bright 或 female-clear\n' +
  '- Edge voice 从音色池选择，气质需与 band 一致（如 band=male-young → 云希/云夏/云帆）\n' +
  '- 语速 rate：话痨/活泼 +20%，高冷/慵懒 -10%~-20%，一般 +0%\n' +
  '- 音调 pitch：轻柔/病娇 +8Hz~+15Hz，低沉/威严 -8Hz~-15Hz，一般 +0Hz\n' +
  '- 严格输出 JSON：{"voice":"zh-CN-xxxNeural","band":"male-mature","rate":"+10%","pitch":"-8Hz","reason":"先说明角色性别，再一句话说明为什么这个声线贴合"}，不要任何额外文字\n\n' +
  '角色的形象与性格：\n';

const VALID_BANDS: VoiceBand[] = LOCAL_VOICE_BANDS.map((b) => b.band);

/** 男女一致性硬校验：band 与 Edge voice 性别冲突时，以 Edge voice 为准修正 band（保证在线/离线声音性别一致） */
function enforceGenderConsistency(p: VoiceProfile): VoiceProfile {
  if (!p.band) return p;
  const slot = EDGE_VOICE_TO_SLOT[p.voice];
  if (slot && bandGender(slot.band) !== bandGender(p.band)) {
    return { ...p, band: slot.band };
  }
  return p;
}

/** 校验 AI 返回的声线是否合法，非法则回退默认 */
export function sanitizeVoiceProfile(p: { voice?: string; band?: string; rate?: string; pitch?: string } | null | undefined): VoiceProfile {
  if (!p) return DEFAULT_VOICE;
  const validVoice = VOICE_POOL.some((v) => v.voice === p.voice);
  const validBand = VALID_BANDS.includes(p.band as VoiceBand);
  const base: VoiceProfile = {
    voice: validVoice ? p.voice! : DEFAULT_VOICE.voice,
    band: validBand ? (p.band as VoiceBand) : undefined,
    rate: /^[+-]\d+%$/.test(p.rate ?? '') ? p.rate! : DEFAULT_VOICE.rate,
    pitch: /^[+-]\d+Hz$/.test(p.pitch ?? '') ? p.pitch! : DEFAULT_VOICE.pitch,
  };
  return enforceGenderConsistency(base);
}

/** 用角色 id 补全本地 sid：band 缺失/旧档位时重映射；sid 按 Edge 音色的专属池选择（性格匹配） */
export function completeVoiceProfile(profile: VoiceProfile, characterId: string): VoiceProfile {
  const slot = EDGE_VOICE_TO_SLOT[profile.voice];
  // band 若为旧版档位或非法值 → 按 Edge 音色重映射
  const band: VoiceBand = VALID_BANDS.includes(profile.band as VoiceBand)
    ? (profile.band as VoiceBand)
    : (slot?.band ?? bandFromEdgeVoice(profile.voice));
  // 已落库 sid 属于该音色专属池（或该档位）且 band 一致 → 保持稳定不重算
  const sidOk =
    Number.isInteger(profile.sid) &&
    profile.sid !== undefined &&
    (VOICE_SID_MAP[profile.voice]?.includes(profile.sid) === true ||
      LOCAL_VOICE_BANDS.find((b) => b.band === band)?.sids.includes(profile.sid) === true);
  if (sidOk && band === profile.band) return profile;
  return { ...profile, band, sid: pickSidByVoice(profile.voice, characterId) };
}
