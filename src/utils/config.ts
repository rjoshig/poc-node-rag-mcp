import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

type LlmProvider = 'internal';
type EmbeddingType = 'xenova';
type VectorDbType = 'vectra';

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

function pickNumber(rawValue: string | undefined, fallback: number): number {
  if (rawValue == null || rawValue.trim() === '') return fallback;
  const value = Number(rawValue);
  if (Number.isFinite(value)) return value;
  return fallback;
}

const internalLlmBaseUrl = process.env.INTERNAL_LLM_BASE_URL ?? 'https://your-internal-openai-compatible-endpoint';
const internalLlmApiKey = process.env.INTERNAL_LLM_API_KEY ?? 'your-api-key';
const internalLlmModel = process.env.INTERNAL_LLM_MODEL ?? 'chatgpt-oss';

export const config = {
  llmProvider: 'internal' as LlmProvider,
  internalLlmBaseUrl,
  internalLlmApiKey,
  internalLlmModel,
  llmBaseUrl: internalLlmBaseUrl,
  llmApiKey: internalLlmApiKey,
  llmModel: internalLlmModel,
  embeddingType: pickEnum(process.env.EMBEDDING_TYPE, ['xenova'] as const, 'xenova', 'EMBEDDING_TYPE') as EmbeddingType,
  xenovaModel: process.env.XENOVA_MODEL ?? 'Xenova/all-MiniLM-L6-v2',
  vectorDbType: pickEnum(process.env.VECTOR_DB_TYPE, ['vectra'] as const, 'vectra', 'VECTOR_DB_TYPE') as VectorDbType,
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
  },
  routerRetrievalConfidenceHigh: pickNumber(process.env.ROUTER_RETRIEVAL_CONFIDENCE_HIGH, 0.2),
  routerRetrievalConfidenceLow: pickNumber(process.env.ROUTER_RETRIEVAL_CONFIDENCE_LOW, 0.12),
  routerIntentConfidenceHigh: pickNumber(process.env.ROUTER_INTENT_CONFIDENCE_HIGH, 0.65)
};
