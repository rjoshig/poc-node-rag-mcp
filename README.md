# poc-node-rag-mcp

## 1) High-Level Overview
`poc-node-rag-mcp` is an **Agentic RAG platform** in Node.js/TypeScript with:
- **LangGraph.js** for supervisor-style intent routing.
- **Backroad UI** for chat, ingestion, retrieval, and config generation workflows.
- **Internal OpenAI-compatible LLM** client (model default: `chatgpt-oss`).
- **Switchable embeddings** (`xenova` / `nomic`).
- **Switchable vector store type** (`chroma` / `pgvector` / `vectra`).
- **Active MCP runtime** for chat, retrieval, and config tools (implemented now).

---

## 2) Current Architecture (MCP-first runtime)

### 2.1 Logical Layers
1. **UI Layer (`src/backroad`)**
   - User interactions (chat, retrieval, ingestion, config generation).
2. **Graph Layer (`src/graphs`)**
   - Intent routing and workflow orchestration.
3. **MCP Client Layer (`src/mcp/mcpClient.ts`)**
   - Graph/UI call MCP tool endpoints through one typed client.
4. **MCP Server Layer (`src/mcp/coreMcpServer.ts`)**
   - Hosts tool handlers for `chat.answer`, `rag.search`, `rag.answer`, `config.generate`.
5. **RAG Layer (`src/rag`)**
   - Ingestion, chunking, embeddings, vector store adapters.
6. **Utility Layer (`src/utils`)**
   - LLM client and config.

### 2.2 Tool Contracts (implemented now)
- `chat.answer`
- `rag.search`
- `rag.answer`
- `config.generate`

All tool responses use a standardized envelope:
```json
{
  "success": true,
  "route": "rag.answer",
  "traceId": "...",
  "confidence": 0.73,
  "result": {},
  "citations": [],
  "errors": [],
  "latencyMs": 42
}
```

### 2.3 Request Behavior
1. User sends input in Backroad page.
2. Graph determines route (`retrieval`, `chat`, `config`).
3. Graph calls relevant MCP tool through `mcpClient`.
4. MCP server executes tool logic and returns standardized envelope.
5. UI renders answer/config/chunks/citations.

---

## 3) Directory Structure

```text
poc-node-rag-mcp/
├── src/
│   ├── agents/
│   ├── backroad/
│   ├── graphs/
│   ├── mcp/
│   │   ├── contracts.ts
│   │   ├── mcpClient.ts
│   │   ├── toolHandlers.ts
│   │   ├── coreMcpServer.ts
│   │   ├── ragMcpServer.ts               # placeholder
│   │   └── salesforceMcpServer.ts        # placeholder
│   ├── rag/
│   ├── tools/
│   ├── utils/
│   ├── types.ts
│   └── index.ts
├── data/
├── data/processed/
├── tests/
├── .env.example
├── generalquestions.md
├── package.json
├── tsconfig.json
└── README.md
```

---

## 4) File-Level Function Map (key modules)

### `src/index.ts`
- Starts core MCP server.
- Ensures data directories exist.
- Starts Backroad app.

### `src/mcp/contracts.ts`
- Zod schemas for MCP tool arguments.
- Tool names enum.
- Standardized response envelope types.

### `src/mcp/toolHandlers.ts`
- Implements business logic for:
  - `chat.answer`
  - `rag.search`
  - `rag.answer`
  - `config.generate`
- Adds traceId, confidence, latency, citations, and errors in envelope.
- Includes retrieval confidence threshold and optional fallback-to-chat strategy.

### `src/mcp/coreMcpServer.ts`
- HTTP MCP endpoint:
  - `GET /health`
  - `POST /mcp`
- Validates request and dispatches to tool handlers.

### `src/mcp/mcpClient.ts`
- Typed tool-call wrappers used by graph/UI.

### `src/graphs/mainGraph.ts`
- Supervisor routing and conditional graph edges.
- Uses MCP client instead of calling local business logic directly.

### `src/backroad/backroadApp.ts`
- Pages:
  - Chat (graph route)
  - Retrieval (explicit `rag.answer`)
  - Ingest
  - Generate Config (`config.generate`)

### `src/rag/ingest.ts`
- Multi-format ingestion pipeline.
- Moves ingested files to `data/processed/`.

### `src/rag/embeddingsFactory.ts`
- `xenova` local embeddings + `nomic` remote option.

### `src/rag/vectorStoreFactory.ts`
- `vectra` implemented.
- `chroma` and `pgvector` scaffolded adapters (extension points).

### `src/agents/incidentResolverAgent.ts` (placeholder)
- Placeholder only (no production behavior yet).

### `src/agents/reportGenerationAgent.ts` (placeholder)
- Placeholder only (no production behavior yet).

---

## 5) Environment Variables

```env
INTERNAL_LLM_BASE_URL=https://your-internal-openai-compatible-endpoint
INTERNAL_LLM_API_KEY=your-api-key
INTERNAL_LLM_MODEL=chatgpt-oss
EMBEDDING_TYPE=xenova
XENOVA_MODEL=Xenova/all-MiniLM-L6-v2
NOMIC_EMBEDDING_URL=https://your-internal-embedding-endpoint
NOMIC_EMBEDDING_API_KEY=your-api-key
VECTOR_DB_TYPE=chroma
CHROMA_COLLECTION=agentic-rag
CHROMA_URL=http://localhost:8000
PGVECTOR_CONNECTION_STRING=postgresql://user:password@host.docker.internal:5432/ai
VECTRA_INDEX_DIR=./vector-index
DATA_DIR=./data
PROCESSED_DIR=./data/processed
MCP_PORT=3001
MCP_BASE_URL=http://localhost:3001
BACKROAD_PORT=3000
SALESFORCE_LOGIN_URL=https://login.salesforce.com
SALESFORCE_CLIENT_ID=your-client-id
SALESFORCE_CLIENT_SECRET=your-client-secret
SALESFORCE_USERNAME=your-username
SALESFORCE_PASSWORD=your-password
SALESFORCE_SECURITY_TOKEN=your-token
```

---

## 6) Setup

```bash
npm install --legacy-peer-deps
cp .env.example .env
```

(Optional for pgvector)
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## 7) Run

### 7.1 Dev
```bash
npm run dev
```
This starts MCP server + Backroad app entry.

### 7.2 Build/Start
```bash
npm run build
npm start
```

### 7.3 Ingest
```bash
npm run ingest
```

### 7.4 Test
```bash
npm test
```

---

## 8) Usage Examples

### A) Retrieval answer with citations
- Ask in Chat: `What is leave policy for probation employees?`
- Routed to retrieval -> calls MCP `rag.answer`.
- Returns answer + citations + confidence.

### B) General chat
- Ask: `Summarize what this platform does.`
- Routed to `chat` -> MCP `chat.answer`.

### C) Config generation
- Ask: `If score < 7 reject, if attribute3 = 7 flag Y.`
- Routed to `config` -> MCP `config.generate`.

### D) Direct Retrieval page
- Use Retrieval page in Backroad and run `rag.answer` explicitly.

---

## 9) RAG Ingestion Pipeline
1. Read file (pdf/xlsx/docx/txt)
2. Extract text
3. Chunk
4. Embed
5. Upsert vectors
6. Move source file to processed folder

---

## 10) Placeholder Scope (intentional)
These remain placeholders by design in current increment:
- Incident resolver advanced workflow.
- Report generation workflow.
- Dedicated Salesforce MCP server internals.
- Dedicated RAG MCP server decomposition (core MCP is active now).

---

## 11) Future Improvement Options
- Replace keyword intent routing with classifier-based router.
- Add persistence/checkpointing for graph state.
- Implement real Chroma and pgvector adapters.
- Add auth/tenant isolation and audit trails to MCP endpoints.
