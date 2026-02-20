import OpenAI from 'openai';
import { config } from './config';

const internalClient = new OpenAI({
  apiKey: config.internalLlmApiKey,
  baseURL: config.internalLlmBaseUrl
});

const xaiClient = new OpenAI({
  apiKey: config.xaiLlmApiKey,
  baseURL: config.xaiLlmBaseUrl
});

const openai = config.llmProvider === 'xai' ? xaiClient : internalClient;

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
