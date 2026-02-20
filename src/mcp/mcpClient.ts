import { config } from '../utils/config';
import {
  ChatAnswerResult,
  ConfigGenerateResult,
  MpcResponseEnvelope,
  RagAnswerResult,
  RagSearchResult,
  ToolName
} from './contracts';

async function callMcp<T>(tool: ToolName, args: Record<string, unknown>): Promise<MpcResponseEnvelope<T>> {
  const response = await fetch(`${config.mcpBaseUrl}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, arguments: args })
  });

  return (await response.json()) as MpcResponseEnvelope<T>;
}

export const mcpClient = {
  chatAnswer(args: { message: string; systemPrompt?: string }) {
    return callMcp<ChatAnswerResult>(ToolName.ChatAnswer, args);
  },
  ragSearch(args: { query: string; topK?: number }) {
    return callMcp<RagSearchResult>(ToolName.RagSearch, args);
  },
  ragAnswer(args: { query: string; topK?: number; fallbackToChat?: boolean }) {
    return callMcp<RagAnswerResult>(ToolName.RagAnswer, args);
  },
  configGenerate(args: { instruction: string; useRagContext?: boolean; topK?: number }) {
    return callMcp<ConfigGenerateResult>(ToolName.ConfigGenerate, args);
  }
};
