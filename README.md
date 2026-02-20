# poc-node-rag-mcp

## 1) High-Level Overview
`poc-node-rag-mcp` is an **Agentic RAG platform** in Node.js/TypeScript with:
- **LangGraph.js** for supervisor-style intent routing.
- **Backroad UI** for chat, ingestion, retrieval, and config generation workflows.
- **Switchable LLM provider** (`internal` OpenAI-compatible endpoint or `xai`).
- **Switchable embeddings** (`xenova` / `nomic` / `xai`).
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


### MCP runtime clarification
- **Active MCP runtime today** is `src/mcp/coreMcpServer.ts` (used by graph and UI).
- `src/mcp/ragMcpServer.placeholder.ts` and `src/mcp/salesforceMcpServer.placeholder.ts` are intentionally named placeholders for future service-splitting and are **not** part of current execution path.

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
2. Graph runs confidence-based routing:
   - small-talk guard
   - LLM intent classifier
   - retrieval query rewrite
   - retrieval probe (`rag.search`) + confidence scoring
   - final route selection (`retrieval`/`chat`/`config`)
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
│   │   ├── tools/
│   │   │   ├── ragSearch.ts
│   │   │   └── salesforceFetch.ts
│   │   ├── coreMcpServer.ts
│   │   ├── ragMcpServer.placeholder.ts   # placeholder (not in active runtime)
│   │   └── salesforceMcpServer.placeholder.ts # placeholder (not in active runtime)
│   ├── rag/
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


### `src/mcp/tools/ragSearch.ts`
- MCP-exposed RAG helper used by MCP handlers.
- Creates query embeddings and runs similarity search via vector adapter.

### `src/mcp/tools/salesforceFetch.ts`
- MCP-side placeholder for future Salesforce fetch integration.

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
- `xenova` local embeddings + `nomic` / `xai` remote options.

### `src/rag/vectorStoreFactory.ts`
- `vectra` and `pgvector` implemented.
- `chroma` scaffolded adapter (extension point).

### `src/agents/incidentResolverAgent.ts` (placeholder)
- Placeholder only (no production behavior yet).

### `src/agents/reportGenerationAgent.ts` (placeholder)
- Placeholder only (no production behavior yet).

---

## 5) Environment Variables

```env
USE_INTERNAL_OR_XAI_LLM=internal
INTERNAL_LLM_BASE_URL=https://your-internal-openai-compatible-endpoint
INTERNAL_LLM_API_KEY=your-api-key
INTERNAL_LLM_MODEL=chatgpt-oss
XAI_LLM_BASE_URL=https://api.x.ai/v1
XAI_LLM_API_KEY=your-xai-api-key
XAI_LLM_MODEL=your-xai-model-name
EMBEDDING_TYPE=xenova
XENOVA_MODEL=Xenova/all-MiniLM-L6-v2
NOMIC_EMBEDDING_URL=https://your-internal-embedding-endpoint
NOMIC_EMBEDDING_API_KEY=your-api-key
XAI_EMBEDDING_BASE_URL=https://api.x.ai/v1
XAI_EMBEDDING_API_KEY=your-xai-api-key
XAI_EMBEDDING_MODEL=your-xai-embedding-model-name
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
ROUTER_RETRIEVAL_CONFIDENCE_HIGH=0.2
ROUTER_RETRIEVAL_CONFIDENCE_LOW=0.12
ROUTER_INTENT_CONFIDENCE_HIGH=0.65
SALESFORCE_LOGIN_URL=https://login.salesforce.com
SALESFORCE_CLIENT_ID=your-client-id
SALESFORCE_CLIENT_SECRET=your-client-secret
SALESFORCE_USERNAME=your-username
SALESFORCE_PASSWORD=your-password
SALESFORCE_SECURITY_TOKEN=your-token
```

### 5.1 LLM Provider Switch (`USE_INTERNAL_OR_XAI_LLM`)

Accepted values:
- `internal`
- `xai`

Behavior:
- If `USE_INTERNAL_OR_XAI_LLM=internal`, the app uses:
  - `INTERNAL_LLM_BASE_URL`
  - `INTERNAL_LLM_API_KEY`
  - `INTERNAL_LLM_MODEL`
- If `USE_INTERNAL_OR_XAI_LLM=xai`, the app uses:
  - `XAI_LLM_BASE_URL`
  - `XAI_LLM_API_KEY`
  - `XAI_LLM_MODEL`

Notes:
- Invalid value falls back to `internal`.
- The LLM client uses OpenAI-compatible chat completions; provide a compatible base URL and model.

### 5.2 Embedding Switch (`EMBEDDING_TYPE`)

Accepted values:
- `xenova` (local embeddings via `@xenova/transformers`)
- `nomic` (remote embedding endpoint via `NOMIC_EMBEDDING_URL` + `NOMIC_EMBEDDING_API_KEY`)
- `xai` (OpenAI-compatible endpoint via `XAI_EMBEDDING_BASE_URL`, `XAI_EMBEDDING_API_KEY`, `XAI_EMBEDDING_MODEL`)

Notes:
- Invalid value falls back to `xenova`.
- `xai` provider calls `<XAI_EMBEDDING_BASE_URL>/embeddings`, so set base URL like `https://api.x.ai/v1`.

### 5.3 Vector Store Switch (`VECTOR_DB_TYPE`)

Accepted values:
- `vectra`
- `chroma`
- `pgvector`

Notes:
- Invalid value falls back to `chroma`.
- Current code has full implementation for `vectra` and `pgvector`.
- `chroma` adapter is scaffolded right now and currently routes through the Vectra fallback adapter.

### 5.4 Router Confidence Tuning

Accepted values:
- `ROUTER_RETRIEVAL_CONFIDENCE_HIGH` (number, default `0.2`)
- `ROUTER_RETRIEVAL_CONFIDENCE_LOW` (number, default `0.12`)
- `ROUTER_INTENT_CONFIDENCE_HIGH` (number, default `0.65`)

Notes:
- Higher retrieval thresholds reduce false-positive retrieval routing.
- Lower retrieval thresholds increase recall but can route more general chat into retrieval.
- Intent confidence threshold controls how strongly classifier output overrides lexical fallback.

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
- Add persistence/checkpointing for graph state.
- Implement real Chroma and pgvector adapters.
- Add auth/tenant isolation and audit trails to MCP endpoints.
