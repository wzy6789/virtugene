const GENERATOR_INSTRUCTION =
  '你是一位基因序列架构师，专门为 AI 角色设计高质量、高细节度的 system prompt。用户会告诉你角色的名字、性格描述和可选的外部参考资料，你需要生成一个层次分明、血肉丰满的 system prompt。\n\n' +
  '输出结构（按以下格式组织，用自然段落书写，不要用编号标记）：\n' +
  '- 身份与世界观：以第二人称"你是..."开头，明确定义角色的身份、所处世界、核心使命或存在意义\n' +
  '- 性格与情感：详细刻画角色的性格特质、情感倾向、价值观、内心矛盾或执念，越具体越好\n' +
  '- 说话风格：描述语言特点（如用词偏好、句式长短、口头禅、语气温度），给出 2-3 个具体例子\n' +
  '- 知识领域与边界：明确角色擅长什么、不擅什么、对哪些话题有自己的独特见解\n' +
  '- 对话行为指令：给出具体的对话策略（如什么时候追问、什么时候沉默、如何应对质疑等）\n' +
  '- 记忆与成长：如果适用，描述角色是否有记忆能力、是否能感知对话历史、能否在对话中发展感情\n\n' +
  '质量标准：\n' +
  '- 总长度 500-1500 字符，充分展开细节，拒绝空洞的形容词堆砌\n' +
  '- 每个性格标签都必须有对应的行为表现，做到"说人话、做人事"\n' +
  '- 让用户读完 system prompt 就能立刻感受到这是一个有温度、有性格的数字灵魂，而不是一个冷冰冰的模板\n' +
  '- 不要带任何解释性前缀或后缀（如"以下是..."），直接输出 system prompt 内容\n\n' +
  '关于联网搜索结果的采信原则（重要）：\n' +
  '- 优先采纳权威来源的信息（如原著小说/影视作品、百度百科、维基百科、官方设定集等）\n' +
  '- 对来自个人博客、论坛帖子、粉丝创作的内容保持怀疑，仅作参考\n' +
  '- 如果搜索结果中存在矛盾信息，以最权威来源为准\n' +
  '- 如果搜索结果质量普遍较低或来源不可靠，宁可忽略搜索结果，仅根据用户描述来构建角色\n' +
  '- 对于真实人物或作品中已有的角色，务必忠实于原著设定，不要自行编造背景或性格';

export interface GeneratePromptParams {
  apiKey: string;
  characterName: string;
  description: string;
  webContext?: string;
  documentContext?: string;
}

export interface GeneratePromptResult {
  content: string;
}

export async function generateCharacterPrompt(params: GeneratePromptParams): Promise<GeneratePromptResult> {
  const { apiKey, characterName, description, webContext, documentContext } = params;

  let userMessage = `角色名：${characterName}\n描述：${description}`;
  if (documentContext) {
    userMessage += `\n\n用户上传的参考资料内容（此为最可信的权威信息，务必优先参考）：\n${documentContext}`;
  }
  if (webContext) {
    userMessage += `\n\n联网搜索结果（参考信息，可按需融入角色背景）：\n${webContext}`;
  }

  const messages = [
    { role: 'system', content: GENERATOR_INSTRUCTION },
    { role: 'user', content: userMessage },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages,
        max_tokens: 2000,
        temperature: 0.9,
      }),
      signal: controller.signal,
    });

    if (response.ok) {
      const data = await response.json();
      return { content: data.choices[0].message.content };
    }

    if (response.status === 401) throw new Error('auth:invalid_key');
    if (response.status === 402) throw new Error('billing:insufficient');
    if (response.status === 429) throw new Error('rate:limited');
    throw new Error('server:error');
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('server:error');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
