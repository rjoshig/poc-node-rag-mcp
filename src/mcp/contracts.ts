import { z } from 'zod';
import { RetrievalChunk, Citation } from '../types';

export const ToolName = {
  ChatAnswer: 'chat.answer',
  RagSearch: 'rag.search',
  RagAnswer: 'rag.answer',
  ConfigGenerate: 'config.generate'
} as const;

export type ToolName = (typeof ToolName)[keyof typeof ToolName];

export const chatAnswerSchema = z.object({
  message: z.string().min(1),
  systemPrompt: z.string().optional()
});

export const ragSearchSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().default(5)
});

export const ragAnswerSchema = z.object({
  query: z.string().min(1),
  retrievalQuery: z.string().min(1).optional(),
  topK: z.number().int().positive().default(5),
  fallbackToChat: z.boolean().default(true)
});

export const configGenerateSchema = z.object({
  instruction: z.string().min(1),
  useRagContext: z.boolean().default(true),
  topK: z.number().int().positive().default(3)
});

export interface MpcResponseEnvelope<T> {
  success: boolean;
  route: ToolName;
  traceId: string;
  confidence: number;
  result?: T;
  citations?: Citation[];
  errors?: string[];
  latencyMs: number;
}

export interface RagAnswerResult {
  answer: string;
  chunks: RetrievalChunk[];
}

export interface RagSearchResult {
  chunks: RetrievalChunk[];
}

export interface ChatAnswerResult {
  answer: string;
}

export interface ConfigGenerateResult {
  generatedConfig: string;
  chunks: RetrievalChunk[];
}

export const mcpRequestSchema = z.object({
  tool: z.enum([ToolName.ChatAnswer, ToolName.RagSearch, ToolName.RagAnswer, ToolName.ConfigGenerate]),
  arguments: z.record(z.any()).default({})
});
