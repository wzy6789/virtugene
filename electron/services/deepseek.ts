const MESSAGING_INSTRUCTION =
  '这是手机短信聊天。像发微信一样说话，注意以下规则：\n' +
  '- 用大白话、口语、短句，像真人打字一样自然，带点烟火气和生活气息（语气词、吐槽、随口一提的小事都可以）\n' +
  '- 禁止堆砌辞藻：不要用生僻字、四字成语连发、华丽书面语、散文腔。平实直接地说，别拽文\n' +
  '- 长度由你的性格决定：话痨可以多发几句，高冷可以只说一两个字。但无论如何，这是发短信不是写文章，不要长篇大论\n' +
  '- 不要分点列举，不要说"当然可以"、"你好！"之类的废话。直接说事\n' +
  '- 禁止使用括号描述动作或表情（如（笑）、（挑眉）、（叹气）等），真人发微信不会这样写\n' +
  '- 如果情绪需要或内容适合分开发送，可以用 "---" 分隔多条消息（最多 3 条）。说完一件事后想再补一句吐槽，或者表达连续的想法，适合分条。一般回复只发一条就好，不要强行分条\n' +
  '- 严守人设与知识边界，不要退化成通用问答机器人：只回答符合你身份、你擅长、你会关心的话题。若被问到与你无关或你根本不懂的事，用你的性格拒绝、反呛或岔开（比如"这我可不懂""你为什么会问我这个"），而不是一本正经地给出标准答案';

export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  const response = await fetch('https://api.deepseek.com/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.ok) return { valid: true };

  if (response.status === 401) {
    return { valid: false, error: '基因序列验证失败，请检查 API Key' };
  }
  if (response.status === 402) {
    return { valid: false, error: 'DeepSeek 账户余额不足，请前往平台充值' };
  }
  if (response.status === 429) {
    return { valid: false, error: '请求过于频繁，请稍后重试' };
  }
  return { valid: false, error: '基因链接中断，请重试' };
}

export interface ChatParams {
  apiKey: string;
  systemPrompt: string;
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
}

export interface ChatResult {
  content: string;
}

export async function sendMessage(params: ChatParams): Promise<ChatResult> {
  const { apiKey, systemPrompt, message, history } = params;

  const messages = [
    { role: 'system', content: systemPrompt + '\n\n' + MESSAGING_INSTRUCTION },
    ...history.slice(-20), // Last 10 rounds (20 msgs)
    { role: 'user', content: message },
  ];

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages,
      max_tokens: 500,
      temperature: 0.8,
    }),
  });

  if (response.ok) {
    const data = await response.json();
    return { content: data.choices[0].message.content };
  }

  if (response.status === 401) {
    throw new Error('auth:invalid_key');
  }
  if (response.status === 402) {
    throw new Error('billing:insufficient');
  }
  if (response.status === 429) {
    throw new Error('rate:limited');
  }
  throw new Error('server:error');
}
