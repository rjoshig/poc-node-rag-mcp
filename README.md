# poc-node-rag-mcp

## 1) High-Level Overview
`poc-node-rag-mcp` is an **Agentic RAG platform** in Node.js/TypeScript with:
- **LangGraph.js** for supervisor-style intent routing.
- **Backroad UI** for chat, ingestion, retrieval, and config generation workflows.
- **Internal OpenAI-compatible LLM** client (model default: `chatgpt-oss`).
- **Switchable embeddings** (`xenova` / `nomic`).
- **Switchable vector store type** (`chroma` / `pgvector` / `vectra`).
- **MCP scaffolding** for future independently deployed tool servers.

The current implementation is designed for extensibility and team ownership by module.

---

## 2) Design & Architecture

### 2.1 Logical Layers
1. **UI Layer (`src/backroad`)**
   - User interaction: chat, upload/ingest, config generation.
2. **Graph Orchestration Layer (`src/graphs`)**
   - Intent routing and agent workflow orchestration via LangGraph.
3. **Agent Layer (`src/agents`)**
   - Domain-specific behavior (retrieval reasoning, config generation, placeholders for future agents).
4. **Tool Layer (`src/tools`)**
   - Reusable tool-like functions (RAG search, Salesforce placeholders).
5. **RAG Layer (`src/rag`)**
   - Embedding provider, vector store adapter, ingestion pipeline.
6. **Platform Utilities (`src/utils`)**
   - Env config + internal LLM client.
7. **MCP Layer (`src/mcp`)**
   - Phase-2 server placeholders for team-owned tool servers.

### 2.2 Request Flow (Behavior)
When a user enters text in Chat page:
1. Input is sent to `runMainGraph()`.
2. Supervisor detects intent (`retrieval` / `chat` / `config`).
3. Graph routes to one node path.
4. Agent executes and returns output to UI.

**Important behavior note:**
- It does **single-route execution per request** (not "chat + retrieval always").
- Policy/compliance-like prompts route to `retrieval` path.
- General prompts route to `chat` path.
- Rule/config prompts route to `config` path.

---

## 3) Directory Structure

```text
poc-node-rag-mcp/
├── src/
│   ├── agents/
│   ├── backroad/
│   ├── graphs/
│   ├── mcp/
│   ├── rag/
│   ├── tools/
│   ├── utils/
│   ├── types.ts
│   └── index.ts
├── data/
├── data/processed/
├── tests/
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## 4) File-by-File Code-Level Function Map

### `src/index.ts`
- Bootstraps app startup.
- Ensures `data/` and `data/processed/` directories exist.
- Starts Backroad app.

### `src/types.ts`
- Shared state and schema-like TypeScript interfaces/types for graph outputs and retrieval payloads.

### `src/utils/config.ts`
- Loads environment variables with `dotenv`.
- Exposes strongly-typed runtime config:
  - LLM settings
  - embedding/vector store toggles
  - directory paths
  - ports
  - Salesforce credentials.

### `src/utils/llm.ts`
- Internal OpenAI-compatible LLM wrapper (`openai` package).
- Uses:
  - `INTERNAL_LLM_BASE_URL`
  - `INTERNAL_LLM_API_KEY`
  - `INTERNAL_LLM_MODEL`.
- Exposes `completeChat()` used by agents.

### `src/rag/embeddingsFactory.ts`
- Embedding provider factory:
  - `XenovaEmbeddingsProvider` (local transformer embeddings)
  - `NomicEmbeddingsProvider` (remote/internal embedding endpoint)
- Exposes `createEmbeddingsProvider()`.

### `src/rag/vectorStoreFactory.ts`
- Vector adapter abstraction.
- Current fully operational adapter: `VectraAdapter`.
- Placeholder/scaffold adapters:
  - `ChromaPlaceholderAdapter`
  - `PgVectorPlaceholderAdapter`
- Exposes `createVectorStore()` and `buildChunkId()`.

### `src/rag/ingest.ts`
- Multi-format document ingestion:
  - PDF (`pdf-parse`)
  - Excel (`xlsx`)
  - DOC/DOCX (`mammoth`)
  - TXT fallback (`fs`)
- Chunking + embedding + vector upsert.
- Moves successfully ingested files to `data/processed/`.
- Supports CLI run (`npm run ingest`).

### `src/tools/ragSearch.ts`
- Tool-like wrapper for similarity search with Zod validation.
- Used by retrieval and config agents.

### `src/tools/salesforceFetch.ts`
- Salesforce fetch placeholder scaffold for future `jsforce` integration.

### `src/agents/supervisor.ts`
- Intent router (`routeIntent`) using deterministic keyword heuristics.

### `src/agents/retrievalAgent.ts`
- Runs RAG search.
- Builds context with citations (`[C1]`, `[C2]`, ...).
- Calls LLM for grounded response.
- Returns answer + citations + chunks.

### `src/agents/complianceAgent.ts`
- Thin wrapper around retrieval for compliance-centric usage.

### `src/agents/batchConfigAgent.ts`
- Retrieves similar context examples.
- Prompts LLM to generate structured config JSON output.

### `src/agents/reportGenerationAgent.ts`
- Placeholder for future enterprise report generation agent.

### `src/agents/incidentResolverAgent.ts`
- Placeholder for incident similarity + resolution recommendation agent.
- Intended to use incident/resolution corpora ingested into vector DB.

### `src/graphs/mainGraph.ts`
- Main LangGraph `StateGraph`:
  - detect intent node
  - retrieval node
  - chat node
  - config node
- Conditional edge routing based on intent.
- Entry function: `runMainGraph(userInput)`.

### `src/backroad/backroadApp.ts`
- Main Backroad app pages:
  - **Chat** (graph-driven answer)
  - **Ingest** (upload + ingest + batch folder ingest)
  - **Generate Config** (rules → JSON)
- Contains runtime-safe fallback if Backroad API shape differs.

### `src/mcp/ragMcpServer.ts`
- Phase-2 placeholder for dedicated RAG MCP server.

### `src/mcp/salesforceMcpServer.ts`
- Phase-2 placeholder for dedicated Salesforce MCP server.

### `tests/supervisor.test.ts`
- Basic intent-routing unit tests.

---

## 5) Environment Variables (`.env.example`)

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

## 7) How to Run

### 7.1 Development (Backroad app)
```bash
npm run dev
```

### 7.2 Build + Start
```bash
npm run build
npm start
```

### 7.3 Ingest via CLI
```bash
npm run ingest
```

### 7.4 Run tests
```bash
npm test
```

---

## 8) Usage Behavior Examples

### Example A: Policy question
Input: `What is leave policy for probation employees?`
- Routed to `retrieval`
- Executes vector search + grounded answer with citations.

### Example B: General chat
Input: `Can you summarize what this platform does?`
- Routed to `chat`
- Direct LLM answer.

### Example C: Batch config generation
Input: `If score < 7 reject consumer, else accept; if attr3 = 7 set flag Y`
- Routed to `config`
- Returns generated JSON-like configuration output.

---

## 9) Ingestion Details

Supported formats:
- `.pdf`, `.txt`, `.doc`, `.docx`, `.xls`, `.xlsx`

Pipeline:
1. Extract text
2. Chunk text
3. Embed chunks
4. Upsert vectors
5. Move file to `data/processed/`

For future incident resolver:
- Add incident knowledge files (e.g., CSV/JSON exports) into `data/`
- Ingest to build historical incident retrieval base.

---

## 10) Extensibility & MCP Strategy

- `src/mcp/*` placeholders define future team-owned MCP servers.
- Recommended approach:
  1. Expose each domain service as MCP server (RAG, Salesforce, Reporting).
  2. Register tool contracts with versioned schemas.
  3. Use supervisor graph for orchestration and policy controls.

---

## 11) Phased Delivery

1. **Phase 1 (current):** LangGraph + Backroad + ingestion + vector fallback.
2. **Phase 2:** Real Chroma/pgvector adapters + production MCP servers.
3. **Phase 3:** HITL approvals, durable graph state/persistence, observability and guardrails.
