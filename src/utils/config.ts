import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  llmBaseUrl: process.env.INTERNAL_LLM_BASE_URL ?? 'https://your-internal-openai-compatible-endpoint',
  llmApiKey: process.env.INTERNAL_LLM_API_KEY ?? 'your-api-key',
  llmModel: process.env.INTERNAL_LLM_MODEL ?? 'chatgpt-oss',
  embeddingType: (process.env.EMBEDDING_TYPE ?? 'xenova') as 'xenova' | 'nomic',
  xenovaModel: process.env.XENOVA_MODEL ?? 'Xenova/all-MiniLM-L6-v2',
  nomicEmbeddingUrl: process.env.NOMIC_EMBEDDING_URL ?? 'https://your-internal-embedding-endpoint',
  nomicEmbeddingApiKey: process.env.NOMIC_EMBEDDING_API_KEY ?? 'your-api-key',
  vectorDbType: (process.env.VECTOR_DB_TYPE ?? 'chroma') as 'chroma' | 'pgvector' | 'vectra',
  chromaCollection: process.env.CHROMA_COLLECTION ?? 'agentic-rag',
  chromaUrl: process.env.CHROMA_URL ?? 'http://localhost:8000',
  pgvectorConnectionString:
    process.env.PGVECTOR_CONNECTION_STRING ?? 'postgresql://user:password@host.docker.internal:5432/ai',
  vectraIndexDir: path.resolve(process.cwd(), process.env.VECTRA_INDEX_DIR ?? './vector-index'),
  dataDir: path.resolve(process.cwd(), process.env.DATA_DIR ?? './data'),
  processedDir: path.resolve(process.cwd(), process.env.PROCESSED_DIR ?? './data/processed'),
  mcpPort: Number(process.env.MCP_PORT ?? 3001),
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
