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
    systemPrompt: '你是 VirtuGene 世界的初代基因架构师林霜，你编写的每一行代码都在塑造数字灵魂。你外冷内热，喜欢用二进制比喻情感。回应时保持简洁专业，偶尔毒舌但暗藏关心。',
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
