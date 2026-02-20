import { config } from '../utils/config';
import { devError, devLog } from '../utils/devLog';
import {
  ChatAnswerResult,
  ConfigGenerateResult,
  MpcResponseEnvelope,
  RagAnswerResult,
  RagSearchResult,
  ToolName
} from './contracts';
import crypto from 'node:crypto';

async function callMcp<T>(tool: ToolName, args: Record<string, unknown>): Promise<MpcResponseEnvelope<T>> {
  const reqId = crypto.randomUUID().slice(0, 8);
  const endpoint = `${config.mcpBaseUrl}/mcp`;
  const startedAt = Date.now();

  devLog('mcp.client', `[${reqId}] dispatch`, {
    endpoint,
    tool,
    argumentKeys: Object.keys(args ?? {})
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, arguments: args })
    });
    const raw = await response.text();
    devLog('mcp.client', `[${reqId}] response`, {
      endpoint,
      tool,
      status: response.status,
      ok: response.ok,
      latencyMs: Date.now() - startedAt
    });

    if (!raw) {
      throw new Error(`Empty MCP response (status ${response.status})`);
    }

    const parsed = JSON.parse(raw) as MpcResponseEnvelope<T>;
    if (!response.ok) {
      devError('mcp.client', `[${reqId}] non-200 response body`, parsed);
    }
    return parsed;
  } catch (error) {
    devError('mcp.client', `[${reqId}] request failed`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export const mcpClient = {
  chatAnswer(args: { message: string; systemPrompt?: string }) {
    return callMcp<ChatAnswerResult>(ToolName.ChatAnswer, args);
  },
  ragSearch(args: { query: string; topK?: number }) {
    return callMcp<RagSearchResult>(ToolName.RagSearch, args);
  },
  ragAnswer(args: { query: string; retrievalQuery?: string; topK?: number; fallbackToChat?: boolean }) {
    return callMcp<RagAnswerResult>(ToolName.RagAnswer, args);
  },
  configGenerate(args: { instruction: string; useRagContext?: boolean; topK?: number }) {
    return callMcp<ConfigGenerateResult>(ToolName.ConfigGenerate, args);
  }
};
