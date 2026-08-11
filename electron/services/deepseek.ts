export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  const response = await fetch('https://api.deepseek.com/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.ok) {
    return { valid: true };
  }

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
