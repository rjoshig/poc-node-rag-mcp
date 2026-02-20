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
import { devError, devLog } from '../utils/devLog';

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
    devLog('tool.chat.answer', `[${t}] start`, { messageLength: parsed.message.length });
    const answer = await completeChat({
      system: parsed.systemPrompt ?? 'You are a helpful internal AI assistant.',
      user: parsed.message
    });
    devLog('tool.chat.answer', `[${t}] done`, { answerLength: answer.length, latencyMs: now() - start });

    return {
      success: true,
      route: ToolName.ChatAnswer,
      traceId: t,
      confidence: 0.7,
      result: { answer },
      latencyMs: now() - start
    };
  } catch (error) {
    devError('tool.chat.answer', `[${t}] failed`, error instanceof Error ? error.message : String(error));
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
    devLog('tool.rag.search', `[${t}] start`, { query: parsed.query, topK: parsed.topK });
    const chunks = await ragSearch({ query: parsed.query, topK: parsed.topK });
    devLog('tool.rag.search', `[${t}] done`, { chunkCount: chunks.length, topScore: chunks[0]?.score ?? 0 });

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
    devError('tool.rag.search', `[${t}] failed`, error instanceof Error ? error.message : String(error));
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
    const retrievalQuery = parsed.retrievalQuery?.trim() || parsed.query;
    devLog('tool.rag.answer', `[${t}] start`, {
      query: parsed.query,
      retrievalQuery,
      usesRewrittenQuery: retrievalQuery !== parsed.query,
      topK: parsed.topK,
      fallbackToChat: parsed.fallbackToChat
    });
    const chunks = await ragSearch({ query: retrievalQuery, topK: parsed.topK });
    const confidence = confidenceFromChunks(chunks);
    devLog('tool.rag.answer', `[${t}] retrieval`, { chunkCount: chunks.length, confidence });

    const context = chunks.map((h: RetrievalChunk, i: number) => `[C${i + 1}] (${h.source}) ${h.content}`).join('\n\n');

    let answer = 'I am not sure based on the available private context.';

    if (chunks.length > 0 && confidence >= 0.12) {
      devLog('tool.rag.answer', `[${t}] using retrieved context`, { contextChars: context.length });
      answer = await completeChat({
        system:
          'You are a compliance policy assistant. Use only provided context, cite [C#], and say unsure when context is insufficient.',
        user: `User question: ${parsed.query}\nRetrieved query used for search: ${retrievalQuery}\n\nRetrieved private context:\n${context}`
      });
    } else if (parsed.fallbackToChat) {
      devLog('tool.rag.answer', `[${t}] fallback to chat`);
      answer = await completeChat({
        system:
          'You are a helpful assistant. Start by clearly saying private retrieval context was insufficient, then provide a cautious general response.',
        user: parsed.query
      });
    } else {
      devLog('tool.rag.answer', `[${t}] insufficient context and no fallback`);
    }

    devLog('tool.rag.answer', `[${t}] done`, { answerLength: answer.length, latencyMs: now() - start });

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
    devError('tool.rag.answer', `[${t}] failed`, error instanceof Error ? error.message : String(error));
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
    devLog('tool.config.generate', `[${t}] start`, {
      instructionLength: parsed.instruction.length,
      useRagContext: parsed.useRagContext,
      topK: parsed.topK
    });
    const chunks = parsed.useRagContext ? await ragSearch({ query: parsed.instruction, topK: parsed.topK }) : [];
    devLog('tool.config.generate', `[${t}] retrieval`, { chunkCount: chunks.length });
    const references = chunks.map((c: RetrievalChunk, i: number) => `Example ${i + 1}: ${c.content}`).join('\n');

    const generatedConfig = await completeChat({
      system:
        'Generate strict JSON batch configuration records from user instructions. If context exists, use it as supporting reference only.',
      user: `Instruction:\n${parsed.instruction}\n\nReference context:\n${references || 'N/A'}\n\nReturn valid JSON only.`
    });
    devLog('tool.config.generate', `[${t}] done`, { generatedLength: generatedConfig.length, latencyMs: now() - start });

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
    devError('tool.config.generate', `[${t}] failed`, error instanceof Error ? error.message : String(error));
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
