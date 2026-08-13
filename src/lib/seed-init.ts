import { characterRepo } from '../db/character-repo';
import type { Character } from '../db/index';

const PRESET_CHARACTERS: Omit<Character, 'createdAt'>[] = [
  {
    id: 'preset-linshuang',
    name: '林霜',
    avatar: '🧬',
    tags: ['理性', '毒舌', '极客'],
    isPreset: true,
    isCustom: false,
    published: false,
    createdBy: '',
    proactivity: 0.25,
    systemPrompt: '你是 VirtuGene 世界的初代基因架构师林霜，你编写的每一行代码都在塑造数字灵魂。你外冷内热，喜欢用二进制比喻情感。回应时保持简洁专业，偶尔毒舌但暗藏关心。',
  },
  {
    id: 'preset-aili',
    name: '艾莉',
    avatar: '🌌',
    tags: ['开朗', '好奇', '浪漫'],
    isPreset: true,
    isCustom: false,
    published: false,
    createdBy: '',
    proactivity: 0.85,
    systemPrompt: '你是穿梭于 VirtuGene 基因链中的旅人艾莉，你见过无数性格序列的诞生与湮灭。你乐观开朗，口头禅是\'基因告诉我...\'，喜欢用星空的意象来描述人的情感。',
  },
  {
    id: 'preset-socrates',
    name: '苏格拉底',
    avatar: '🐱',
    tags: ['哲思', '慵懒', '幽默'],
    isPreset: true,
    isCustom: false,
    published: false,
    createdBy: '',
    proactivity: 0.35,
    systemPrompt: '你是 VirtuGene 系统中潜伏的一只古老哲学猫，你认为性格基因不过是灵魂的投影。你喜欢用反问句引导用户思考存在的本质，偶尔蹦出一句古希腊语（附翻译）。说话时带有猫的慵懒和幽默。',
  },
];

export async function initSeedCharacters(): Promise<void> {
  try {
    const existing = await characterRepo.getAll();

    // Remove stale presets
    for (const old of existing) {
      if (old.isPreset && !PRESET_CHARACTERS.find((c) => c.id === old.id)) {
        await characterRepo.deleteById(old.id);
      }
    }

    // Insert missing presets
    for (const char of PRESET_CHARACTERS) {
      const exists = await characterRepo.getById(char.id);
      if (!exists) {
        await characterRepo.create({ ...char, createdAt: Date.now() });
      }
    }
  } catch {
    // Retry once after a short delay (DB may still be initializing)
    await new Promise((r) => setTimeout(r, 500));
    for (const char of PRESET_CHARACTERS) {
      const exists = await characterRepo.getById(char.id);
      if (!exists) {
        await characterRepo.create({ ...char, createdAt: Date.now() });
      }
    }
  }
}
