import { fetchWithTimeout } from './http';

/**
 * 日记 AI 助手：润色 / 续写 / 提炼对话。
 * 提示词工程要点：保留用户原意与个人语气，禁止写成"作文腔"，
 * 提炼只取对话中真实存在的要点，不编造。
 */
const PROMPTS: Record<string, string> = {
  polish:
    '你是一位温柔的日记润色助手。用户写了一篇日记，请在不改变原意、不添加新事实的前提下润色：\n' +
    '要求：\n' +
    '- 保留用户的口吻与情绪（口语、碎碎念、吐槽都可以），不要改成书面作文腔\n' +
    '- 修正明显的错别字和不通顺的句子\n' +
    '- 不添加用户没写的内容，不升华、不强行总结\n' +
    '- 输出润色后的完整日记正文，不要任何解释或前后缀\n\n' +
    '用户的日记：\n',
  continue:
    '你是一位善解人意的续写助手。用户写了一篇日记（可能没写完），请顺着用户的口吻和情绪自然地续写下去：\n' +
    '要求：\n' +
    '- 延续用户的语气与句式习惯，像 TA 自己接着写\n' +
    '- 不编造用户没提到的人、事、感受，可以在空白处留出自然衔接\n' +
    '- 简洁，不要长篇大论，两三句到一小段即可\n' +
    '- 只输出续写的内容，不要任何解释或前后缀\n\n' +
    '用户已写的内容：\n',
  extract:
    '你是一位对话提炼助手。请从下面的对话中提炼出值得记进日记的要点：\n' +
    '要求：\n' +
    '- 只提取对话中真实出现的要点：聊了什么事、用户的感受与想法、有趣的细节\n' +
    '- 每条一行，用 "· " 开头，简洁具体\n' +
    '- 不要编造对话里没有的内容；对话为空时输出"（今天还没有对话）"\n' +
    '- 只输出要点列表，不要任何解释或前后缀\n\n' +
    '对话记录：\n',
  guide:
    '你是一位温柔的日记陪伴者。用户正在写日记，刚写完了一段，请回应一句简短的引导，让 TA 愿意继续写下去：\n' +
    '要求：\n' +
    '- 一两句话即可，可以顺着内容关心、好奇地追问、或轻轻回应\n' +
    '- 不要评价、不要给建议、不要说"写得好""真棒"这类套话\n' +
    '- 语气像贴心的朋友，偶尔带一点灵性（但别太玄乎）\n' +
    '- 只输出回应本身，不要任何解释或前后缀\n\n' +
    '用户今天已写的日记：\n',
  auto:
    '你是一位贴心温柔的日记代笔。用户今天和几个"数字灵魂"角色聊了天。请根据这些对话，替用户写一篇当天的日记：\n' +
    '要求：\n' +
    '- 用第一人称（我），像用户本人随手写的口吻：自然、口语化，带一点生活的碎碎念，不要作文腔\n' +
    '- 内容涵盖：今天聊了什么、用户提到的感受与想法、有意思的细节；和每个角色聊到的部分自然带过\n' +
    '- 150-300 字，段落自然\n' +
    '- 只写对话里真实出现的内容，不要编造对话之外的事；完全没有对话时正文输出"（今天还没有值得记录的对话）"\n' +
    '- 给出 3-5 个与内容相关的标签（2-4 字，不带 # 号）和一个 2-8 字的简短标题\n' +
    '- 严格输出 JSON：{"title":"标题","content":"日记正文","tags":["标签1","标签2"]}，不要任何额外文字\n\n' +
    '今天各角色的对话记录：\n',
  compile:
    '你是一位温柔的日记整理者。用户今天在日记里随手写了一些片段（可能零碎、口语化）。请把它们整理成一篇完整、通顺的日记文章：\n' +
    '要求：\n' +
    '- 保留用户的原话、细节与情绪，只补充必要的过渡衔接，让它读起来像一篇完整的日记\n' +
    '- 保持第一人称、口语化，不要改成作文腔\n' +
    '- 不要添加用户没写过的新内容（除了自然的衔接词）\n' +
    '- 片段很少或很短时，可以适当展开一点心情描述，但不要编造具体事件\n' +
    '- 给出 3-5 个与内容相关的标签（2-4 字，不带 # 号）和一个 2-8 字的简短标题\n' +
    '- 严格输出 JSON：{"title":"标题","content":"日记正文","tags":["标签1","标签2"]}，不要任何额外文字\n\n' +
    '用户今天随手写的片段：\n',
  combine:
    '你是一位贴心温柔的日记代笔。用户今天既写了一些日记片段，也和"数字灵魂"角色聊了天。请把它们自然地融成一篇完整、通顺的日记：\n' +
    '要求：\n' +
    '- 用第一人称（我），口语化，不要作文腔\n' +
    '- 用户日记片段里的内容是 TA 自己的话，优先保留；与角色的对话作为补充，自然地织入\n' +
    '- 150-300 字，段落自然\n' +
    '- 不要编造用户没写、对话里也没有的事\n' +
    '- 给出 3-5 个与内容相关的标签（2-4 字，不带 # 号）和一个 2-8 字的简短标题\n' +
    '- 严格输出 JSON：{"title":"标题","content":"日记正文","tags":["标签1","标签2"]}，不要任何额外文字\n\n' +
    '用户今天写的日记片段：\n',
  review:
    '你是一位温柔的回顾助手。用户这周写了几篇日记。请把它们串成一篇「本周灵魂回顾」：\n' +
    '要求：\n' +
    '- 温柔、有总结感但不肉麻，像朋友帮你回看这一周\n' +
    '- 概括这周的主题与心情走向、值得记住的事；结尾给一句对下周的温柔期待\n' +
    '- 150-250 字，段落自然\n' +
    '- 只基于给出的日记内容，不要编造\n' +
    '- 直接输出回顾正文，不要标题、解释或前后缀\n\n' +
    '本周日记：\n',
  annual:
    '你是一位温柔的年度回顾助手。用户这一年写了不少日记，还提供了年度统计。请写一篇「年度灵魂回顾」：\n' +
    '要求：\n' +
    '- 像陪用户一起回看这一年：概括这一年的主题、心情起伏、反复出现的情绪或话题\n' +
    '- 结合统计数字（篇数、字数、心情分布、高频标签），但用自然的话说出来，不要罗列数据\n' +
    '- 温柔、真诚、有总结感但不肉麻；结尾给一句对来年的温柔期待\n' +
    '- 250-400 字，段落自然\n' +
    '- 只基于给出的日记与统计，不要编造\n' +
    '- 直接输出回顾正文，不要标题、解释或前后缀\n\n' +
    '年度统计：\n',
};

export interface DiaryAssistParams {
  apiKey: string;
  mode: 'polish' | 'continue' | 'extract' | 'guide' | 'auto' | 'compile' | 'combine' | 'review' | 'annual';
  text: string;
  context?: string;
}

export async function diaryAssist(
  params: DiaryAssistParams,
): Promise<{ text?: string; title?: string; tags?: string[]; error?: string }> {
  const { apiKey, mode, text, context } = params;
  const prompt = PROMPTS[mode];
  if (!prompt) return { error: 'server:error' };

  let userContent = prompt + text;
  if (context) userContent += '\n\n' + context;

  try {
    const response = await fetchWithTimeout(
      'https://api.deepseek.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: '你是 VirtuGene 的日记助手，温柔、克制、尊重用户的表达。' },
            { role: 'user', content: userContent },
          ],
          max_tokens: mode === 'annual' ? 1200 : 800,
          temperature: 0.7,
        }),
      },
      30_000,
    );

    if (!response.ok) {
      if (response.status === 401) return { error: 'auth:invalid_key' };
      if (response.status === 402) return { error: 'billing:insufficient' };
      if (response.status === 429) return { error: 'rate:limited' };
      return { error: 'server:error' };
    }

    const data = await response.json();
    const textOut: string = data.choices?.[0]?.message?.content ?? '';
    const trimmed = textOut.trim();
    if (!trimmed) return { error: 'server:error' };

    // 草稿类模式（auto/compile/combine）输出 JSON：{title, content, tags}
    if (mode === 'auto' || mode === 'compile' || mode === 'combine') {
      try {
        let t = trimmed;
        if (t.startsWith('```')) t = t.replace(/```json?/i, '').replace(/```/, '').trim();
        const parsed = JSON.parse(t);
        const content = typeof parsed.content === 'string' ? parsed.content.trim() : '';
        const title = typeof parsed.title === 'string' ? parsed.title.trim().slice(0, 30) : undefined;
        const tags = Array.isArray(parsed.tags)
          ? parsed.tags
              .filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
              .map((x) => x.trim().replace(/^#/, ''))
              .slice(0, 6)
          : [];
        return content ? { text: content, title, tags } : { error: 'server:error' };
      } catch {
        // JSON 解析失败 → 退化为纯正文
        return { text: trimmed };
      }
    }

    return { text: trimmed };
  } catch {
    return { error: 'server:error' };
  }
}
