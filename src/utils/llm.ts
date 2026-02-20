import OpenAI from 'openai';
import { config } from './config';
import { devError, devLog } from './devLog';

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
  const startedAt = Date.now();
  devLog('llm.chat', 'calling chat.completions', {
    provider: config.llmProvider,
    baseUrl: config.llmBaseUrl,
    model: config.llmModel,
    userChars: params.user.length
  });
  try {
    const response = await openai.chat.completions.create({
      model: config.llmModel,
      temperature: 0.2,
      messages: [
        { role: 'system', content: params.system ?? 'You are a helpful internal AI assistant.' },
        { role: 'user', content: params.user }
      ]
    });

    const answer = response.choices[0]?.message?.content ?? '';
    devLog('llm.chat', 'chat.completions response', {
      provider: config.llmProvider,
      model: config.llmModel,
      latencyMs: Date.now() - startedAt,
      answerChars: answer.length
    });
    return answer;
  } catch (error) {
    devError('llm.chat', 'chat.completions failed', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export { openai };
