import OpenAI from 'openai';
import { config } from './config';

const openai = new OpenAI({
  apiKey: config.llmApiKey,
  baseURL: config.llmBaseUrl
});

export async function completeChat(params: { system?: string; user: string }): Promise<string> {
  const response = await openai.chat.completions.create({
    model: config.llmModel,
    temperature: 0.2,
    messages: [
      { role: 'system', content: params.system ?? 'You are a helpful internal AI assistant.' },
      { role: 'user', content: params.user }
    ]
  });

  return response.choices[0]?.message?.content ?? '';
}

export { openai };
