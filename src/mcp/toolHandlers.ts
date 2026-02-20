import crypto from 'node:crypto';
import {
  ChatAnswerResult,
  chatAnswerSchema,
  ConfigGenerateResult,
  configGenerateSchema,
  MpcResponseEnvelope,
  RagAnswerResult,
  ragAnswerSchema,
  RagSearchResult,
  ragSearchSchema,
  ToolName
} from './contracts';
import { completeChat } from '../utils/llm';
import { ragSearch } from './tools/ragSearch';
import { RetrievalChunk } from '../types';

function traceId() {
  return crypto.randomUUID();
}

function now() {
  return Date.now();
}

function buildCitations(chunks: RetrievalChunk[]) {
  return chunks.map((c: RetrievalChunk, i: number) => ({
    id: `C${i + 1}`,
    source: c.source,
    score: c.score
  }));
}

function confidenceFromChunks(chunks: RetrievalChunk[]) {
  if (!chunks.length) return 0;
  const top = chunks[0]?.score ?? 0;
  return Math.max(0, Math.min(1, Number(top.toFixed(4))));
}

export async function handleChatAnswer(args: unknown): Promise<MpcResponseEnvelope<ChatAnswerResult>> {
  const start = now();
  const t = traceId();

  try {
    const parsed = chatAnswerSchema.parse(args);
    const answer = await completeChat({
      system: parsed.systemPrompt ?? 'You are a helpful internal AI assistant.',
      user: parsed.message
    });

    return {
      success: true,
      route: ToolName.ChatAnswer,
      traceId: t,
      confidence: 0.7,
      result: { answer },
      latencyMs: now() - start
    };
  } catch (error) {
    return {
      success: false,
      route: ToolName.ChatAnswer,
      traceId: t,
      confidence: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      latencyMs: now() - start
    };
  }
}

export async function handleRagSearch(args: unknown): Promise<MpcResponseEnvelope<RagSearchResult>> {
  const start = now();
  const t = traceId();

  try {
    const parsed = ragSearchSchema.parse(args);
    const chunks = await ragSearch({ query: parsed.query, topK: parsed.topK });

    return {
      success: true,
      route: ToolName.RagSearch,
      traceId: t,
      confidence: confidenceFromChunks(chunks),
      result: { chunks },
      citations: buildCitations(chunks),
      latencyMs: now() - start
    };
  } catch (error) {
    return {
      success: false,
      route: ToolName.RagSearch,
      traceId: t,
      confidence: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      latencyMs: now() - start
    };
  }
}

export async function handleRagAnswer(args: unknown): Promise<MpcResponseEnvelope<RagAnswerResult>> {
  const start = now();
  const t = traceId();

  try {
    const parsed = ragAnswerSchema.parse(args);
    const chunks = await ragSearch({ query: parsed.query, topK: parsed.topK });
    const confidence = confidenceFromChunks(chunks);

    const context = chunks.map((h: RetrievalChunk, i: number) => `[C${i + 1}] (${h.source}) ${h.content}`).join('\n\n');

    let answer = 'I am not sure based on the available private context.';

    if (chunks.length > 0 && confidence >= 0.12) {
      answer = await completeChat({
        system:
          'You are a compliance policy assistant. Use only provided context, cite [C#], and say unsure when context is insufficient.',
        user: `User question: ${parsed.query}\n\nRetrieved private context:\n${context}`
      });
    } else if (parsed.fallbackToChat) {
      answer = await completeChat({
        system:
          'You are a helpful assistant. Mention that private retrieval context was insufficient and provide a cautious general response.',
        user: parsed.query
      });
    }

    return {
      success: true,
      route: ToolName.RagAnswer,
      traceId: t,
      confidence,
      result: { answer, chunks },
      citations: buildCitations(chunks),
      latencyMs: now() - start
    };
  } catch (error) {
    return {
      success: false,
      route: ToolName.RagAnswer,
      traceId: t,
      confidence: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      latencyMs: now() - start
    };
  }
}

export async function handleConfigGenerate(args: unknown): Promise<MpcResponseEnvelope<ConfigGenerateResult>> {
  const start = now();
  const t = traceId();

  try {
    const parsed = configGenerateSchema.parse(args);
    const chunks = parsed.useRagContext ? await ragSearch({ query: parsed.instruction, topK: parsed.topK }) : [];
    const references = chunks.map((c: RetrievalChunk, i: number) => `Example ${i + 1}: ${c.content}`).join('\n');

    const generatedConfig = await completeChat({
      system:
        'Generate strict JSON batch configuration records from user instructions. If context exists, use it as supporting reference only.',
      user: `Instruction:\n${parsed.instruction}\n\nReference context:\n${references || 'N/A'}\n\nReturn valid JSON only.`
    });

    return {
      success: true,
      route: ToolName.ConfigGenerate,
      traceId: t,
      confidence: chunks.length ? confidenceFromChunks(chunks) : 0.6,
      result: { generatedConfig, chunks },
      citations: buildCitations(chunks),
      latencyMs: now() - start
    };
  } catch (error) {
    return {
      success: false,
      route: ToolName.ConfigGenerate,
      traceId: t,
      confidence: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      latencyMs: now() - start
    };
  }
}
