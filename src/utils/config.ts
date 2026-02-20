import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

type LlmProvider = 'internal' | 'xai';
type EmbeddingType = 'xenova' | 'nomic' | 'xai';
type VectorDbType = 'chroma' | 'pgvector' | 'vectra';

function pickEnum<T extends string>(
  rawValue: string | undefined,
  allowed: readonly T[],
  fallback: T,
  envName: string
): T {
  const normalized = rawValue?.trim().toLowerCase();
  if (!normalized) return fallback;
  if ((allowed as readonly string[]).includes(normalized)) return normalized as T;

  console.warn(
    `[config] Invalid ${envName}="${rawValue}". Falling back to "${fallback}". Accepted values: ${allowed.join(', ')}`
  );
  return fallback;
}

const llmProvider = pickEnum(
  process.env.USE_INTERNAL_OR_XAI_LLM,
  ['internal', 'xai'] as const,
  'internal',
  'USE_INTERNAL_OR_XAI_LLM'
);

const internalLlmBaseUrl = process.env.INTERNAL_LLM_BASE_URL ?? 'https://your-internal-openai-compatible-endpoint';
const internalLlmApiKey = process.env.INTERNAL_LLM_API_KEY ?? 'your-api-key';
const internalLlmModel = process.env.INTERNAL_LLM_MODEL ?? 'chatgpt-oss';

const xaiLlmBaseUrl = process.env.XAI_LLM_BASE_URL ?? 'https://api.x.ai/v1';
const xaiLlmApiKey = process.env.XAI_LLM_API_KEY ?? 'your-xai-api-key';
const xaiLlmModel = process.env.XAI_LLM_MODEL ?? 'your-xai-model-name';

export const config = {
  llmProvider,
  internalLlmBaseUrl,
  internalLlmApiKey,
  internalLlmModel,
  xaiLlmBaseUrl,
  xaiLlmApiKey,
  xaiLlmModel,
  llmBaseUrl: llmProvider === 'xai' ? xaiLlmBaseUrl : internalLlmBaseUrl,
  llmApiKey: llmProvider === 'xai' ? xaiLlmApiKey : internalLlmApiKey,
  llmModel: llmProvider === 'xai' ? xaiLlmModel : internalLlmModel,
  embeddingType: pickEnum(process.env.EMBEDDING_TYPE, ['xenova', 'nomic', 'xai'] as const, 'xenova', 'EMBEDDING_TYPE') as EmbeddingType,
  xenovaModel: process.env.XENOVA_MODEL ?? 'Xenova/all-MiniLM-L6-v2',
  nomicEmbeddingUrl: process.env.NOMIC_EMBEDDING_URL ?? 'https://your-internal-embedding-endpoint',
  nomicEmbeddingApiKey: process.env.NOMIC_EMBEDDING_API_KEY ?? 'your-api-key',
  xaiEmbeddingBaseUrl: process.env.XAI_EMBEDDING_BASE_URL ?? xaiLlmBaseUrl,
  xaiEmbeddingApiKey: process.env.XAI_EMBEDDING_API_KEY ?? xaiLlmApiKey,
  xaiEmbeddingModel: process.env.XAI_EMBEDDING_MODEL ?? xaiLlmModel,
  vectorDbType: pickEnum(process.env.VECTOR_DB_TYPE, ['chroma', 'pgvector', 'vectra'] as const, 'chroma', 'VECTOR_DB_TYPE') as VectorDbType,
  chromaCollection: process.env.CHROMA_COLLECTION ?? 'agentic-rag',
  chromaUrl: process.env.CHROMA_URL ?? 'http://localhost:8000',
  pgvectorConnectionString:
    process.env.PGVECTOR_CONNECTION_STRING ?? 'postgresql://user:password@host.docker.internal:5432/ai',
  vectraIndexDir: path.resolve(process.cwd(), process.env.VECTRA_INDEX_DIR ?? './vector-index'),
  dataDir: path.resolve(process.cwd(), process.env.DATA_DIR ?? './data'),
  processedDir: path.resolve(process.cwd(), process.env.PROCESSED_DIR ?? './data/processed'),
  mcpPort: Number(process.env.MCP_PORT ?? 3001),
  mcpBaseUrl: process.env.MCP_BASE_URL ?? `http://localhost:${Number(process.env.MCP_PORT ?? 3001)}`,
  backroadPort: Number(process.env.BACKROAD_PORT ?? 3000),
  salesforce: {
    loginUrl: process.env.SALESFORCE_LOGIN_URL ?? 'https://login.salesforce.com',
    clientId: process.env.SALESFORCE_CLIENT_ID ?? '',
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET ?? '',
    username: process.env.SALESFORCE_USERNAME ?? '',
    password: process.env.SALESFORCE_PASSWORD ?? '',
    securityToken: process.env.SALESFORCE_SECURITY_TOKEN ?? ''
  }
};
