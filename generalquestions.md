# General Questions & Function Flows

## 1) What changed in this iteration?
MCP is now active for core runtime behavior (not just future placeholder).

Implemented MCP tools now:
- `chat.answer`
- `rag.search`
- `rag.answer`
- `config.generate`

Graph and UI now call MCP through a typed client (`src/mcp/mcpClient.ts`).

### Clarification on placeholder files
- `src/mcp/coreMcpServer.ts` is the **active MCP runtime** used now.
- `src/mcp/ragMcpServer.placeholder.ts` and `src/mcp/salesforceMcpServer.placeholder.ts` are naming-safe placeholders for future decomposition and are not executed in the current flow.

---

## 2) What does "single route per request" mean now?
Each user message is classified once and sent to exactly one graph path:
- `retrieval`
- `chat`
- `config`

This avoids running all paths simultaneously for every prompt.

### Normal patterns in production
1. **Single route** (current): simple, fast.
2. **Retrieval-first with fallback**: if low confidence, fallback to chat.
3. **Parallel route + fusion**: costlier but can improve quality.

Current implementation includes fallback support in MCP `rag.answer` via `fallbackToChat`.

---

## 3) End-to-end flows

### A) Policy/private data question
1. Backroad Chat sends prompt to `runMainGraph()`.
2. Supervisor routes to `retrieval`.
3. Graph calls MCP client `rag.answer`.
4. MCP server runs `handleRagAnswer()`:
   - vector retrieve
   - confidence calculation
   - grounded LLM response from retrieved context
   - optional fallback chat if low confidence
5. Returns standardized envelope with citations.

### B) General question
1. Route -> `chat`
2. Calls MCP `chat.answer`
3. Returns envelope with answer.

### C) Config generation
1. Route -> `config`
2. Calls MCP `config.generate`
3. If `useRagContext=true`, retrieves examples first
4. LLM generates strict JSON output.

### D) File ingestion
1. Upload via Backroad page or CLI `npm run ingest`
2. Parse by extension
3. Chunk + embed + upsert
4. Move file to `data/processed/`

---

## 4) MCP response envelope
All MCP tool handlers return:

```json
{
  "success": true,
  "route": "rag.answer",
  "traceId": "uuid",
  "confidence": 0.64,
  "result": {},
  "citations": [],
  "errors": [],
  "latencyMs": 18
}
```

Why this helps:
- Consistent UI rendering
- Easier logging and observability
- Simpler downstream integration

---

## 5) Key files and what they do

## `src/index.ts`
- Starts MCP server and Backroad app.

## `src/mcp/contracts.ts`
- Defines MCP tool names, schemas, and response envelope types.

## `src/mcp/coreMcpServer.ts`
- Implements `/mcp` endpoint and tool dispatch.

## `src/mcp/toolHandlers.ts`
- Implements logic for chat/retrieval/config tools.
- Adds confidence, trace ID, errors, latency.

## `src/mcp/mcpClient.ts`
- Graph/UI side MCP caller wrappers.

## `src/graphs/mainGraph.ts`
- Supervisor routing and node execution through MCP client.

## `src/backroad/backroadApp.ts`
- UI pages:
  - Chat
  - Retrieval
  - Ingest
  - Generate Config

## `src/rag/embeddingsFactory.ts`
- Embedding provider switch (`xenova` / `nomic`).

## `src/rag/vectorStoreFactory.ts`
- Vector store adapters (`vectra` implemented, chroma/pgvector scaffold).

## `src/rag/ingest.ts`
- Multi-format ingestion and processed-file move.

## `src/agents/incidentResolverAgent.ts`
- Placeholder only in this phase.

## `src/agents/reportGenerationAgent.ts`
- Placeholder only in this phase.

---

## 6) Placeholder policy (intentional)
Still placeholders by design:
- Incident resolver advanced behavior
- Report generation workflow
- Dedicated Salesforce MCP implementation details
- Dedicated split RAG MCP service decomposition (core MCP is active now)

---

## 7) Practical examples

### Call MCP rag.answer directly
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool":"rag.answer","arguments":{"query":"What is leave policy?","topK":5,"fallbackToChat":true}}'
```

### Call MCP config.generate directly
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool":"config.generate","arguments":{"instruction":"if score < 7 reject","useRagContext":true,"topK":3}}'
```

### Ingest docs via CLI
```bash
npm run ingest
```

---

## 8) Notes
- If embeddings/vector endpoint is unavailable, retrieval/config may fail with envelope errors.
- Backroad library APIs can vary by version; app has guardrails for missing API surface.
