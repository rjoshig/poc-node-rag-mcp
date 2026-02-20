const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const config = {
  llmApiBase: process.env.LLM_API_BASE || 'https://your-internal-llm-api.com',
  llmApiKey: process.env.LLM_API_KEY || 'your-api-key',
  embedModel: process.env.LLM_EMBED_MODEL || 'text-embedding-model',
  embeddingProvider: process.env.EMBEDDING_PROVIDER || 'natural', // natural | xenova | api
  embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS || 256),
  xenovaModel: process.env.XENOVA_MODEL || 'Xenova/all-MiniLM-L6-v2',
  chatModel: process.env.LLM_CHAT_MODEL || 'chat-completion-model',
  useLangchain: String(process.env.USE_LANGCHAIN || 'false').toLowerCase() === 'true',
  mcpPort: Number(process.env.MCP_PORT || 3001),
  topK: Number(process.env.TOP_K || 5),
  chunkSize: Number(process.env.CHUNK_SIZE || 500),
  chunkOverlap: Number(process.env.CHUNK_OVERLAP || 50),
  docsDir: path.resolve(process.cwd(), process.env.DOCS_DIR || './docs'),
  vectorIndexDir: path.resolve(process.cwd(), process.env.VECTOR_INDEX_DIR || './vector-index')
};

module.exports = config;
