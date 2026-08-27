/**
 * AI 声线判定链路测试（真实调用 DeepSeek）：
 * 用法：$env:DEEPSEEK_API_KEY="sk-xxx"; node scripts/test-voice-assign.mjs [角色名] [性格描述]
 * 不带参数时使用内置示例角色（林霜）。
 */
import { VOICE_SELECT_PROMPT, sanitizeVoiceProfile, completeVoiceProfile } from '../src/lib/voice-map.ts';

const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
  console.error('请先设置环境变量 DEEPSEEK_API_KEY（例如：$env:DEEPSEEK_API_KEY="sk-xxx"）');
  process.exit(1);
}

const name = process.argv[2] ?? '林霜';
const desc = process.argv[3] ?? '你是 VirtuGene 世界的初代基因架构师林霜，你编写的每一行代码都在塑造数字灵魂。你外冷内热，喜欢用二进制比喻情感。回应时保持简洁专业，偶尔毒舌但暗藏关心。';

console.log(`角色：${name}\n描述：${desc.slice(0, 80)}...\n正在调用 DeepSeek 判定声线...`);

const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'deepseek-v4-flash',
    messages: [
      { role: 'system', content: '你是 VirtuGene 的声线设计师，为数字灵魂挑选合适的语音。' },
      { role: 'user', content: VOICE_SELECT_PROMPT + `角色名：${name}\n性格与说话风格：\n${desc}` },
    ],
    max_tokens: 300,
    temperature: 0.4,
  }),
});

console.log('HTTP', response.status);
if (!response.ok) {
  console.log('响应体：', (await response.text()).slice(0, 300));
  process.exit(1);
}
const data = await response.json();
const text = data.choices?.[0]?.message?.content ?? '';
console.log('\nAI 原始返回：\n' + text);

let t = text.trim();
if (t.startsWith('```')) t = t.replace(/```json?/i, '').replace(/```/, '').trim();
const parsed = JSON.parse(t);
const profile = completeVoiceProfile(sanitizeVoiceProfile(parsed), 'test-char-001');
console.log('\n✅ 判定结果（校验+补全后落库形态）：');
console.log(JSON.stringify(profile, null, 2));
