# General Questions & Function Flows

This document explains how each major function/module in the project works, with practical flow and example usage.

## 1) Core runtime concept

### What does "single route per request" mean?
In `mainGraph`, each input is classified once by `routeIntent()` and then routed to exactly one node path (`retrieval` OR `chat` OR `config`).

- It does **not** run all routes for one message.
- This keeps latency lower and avoids mixing conflicting responses.

Normal alternatives in larger systems:
1. **Single-route (current):** fast, predictable, simple.
2. **Multi-route parallel:** run retrieval + chat in parallel and fuse; better recall but more cost/complexity.
3. **Two-stage route:** start retrieval first, fallback to chat if confidence is low.
4. **Tool-calling planner:** LLM decides tool sequence dynamically.

Current repo uses option 1 by default.

---

## 2) End-to-end request flows

### A) Policy question flow
Input: "What is leave policy during probation?"
1. Backroad Chat page calls `runMainGraph()`.
2. `detectIntentNode` calls `routeIntent()` -> `retrieval`.
3. `retrievalNode` runs `retrievalAgent()`.
4. `retrievalAgent()` calls `ragSearch()`.
5. `ragSearch()` computes query embedding + vector similarity search.
6. Top chunks become context with citation labels.
7. `completeChat()` sends query + context to internal LLM.
8. UI shows answer + citations/chunks.

### B) General chat flow
Input: "Summarize what this platform does"
1. `routeIntent()` -> `chat`.
2. `chatNode` calls `completeChat()` directly.
3. UI shows general LLM response.

### C) Config generation flow
Input: "If score < 7 reject consumer, else accept"
1. `routeIntent()` -> `config`.
2. `configNode` runs `batchConfigAgent()`.
3. Agent retrieves similar context via `ragSearch()`.
4. Agent prompts LLM to return structured JSON.
5. UI renders config payload.

### D) Ingestion flow
1. File uploaded from Backroad page or found in `data/` via CLI.
2. `ingestFile()` extracts text by file type.
3. Text chunked.
4. Chunks embedded via provider factory.
5. Upsert to vector store adapter.
6. File moved to `data/processed/`.

---

## 3) File-by-file function guide

## `src/index.ts`
- `bootstrap()`
  - Ensures runtime directories exist.
  - Starts Backroad app.

## `src/utils/config.ts`
- `config`
  - Central env/config object with LLM, embeddings, vector DB, directories, Salesforce, ports.

## `src/utils/llm.ts`
- `completeChat({ system?, user })`
  - Calls internal OpenAI-compatible chat completion endpoint.
  - Returns plain string output.

## `src/agents/supervisor.ts`
- `routeIntent(input)`
  - Keyword-based intent router.
  - Returns `retrieval | chat | config`.

## `src/agents/retrievalAgent.ts`
- `retrievalAgent(query)`
  - Calls RAG search.
  - Builds citation context.
  - Calls LLM with grounding instruction + context.
  - Returns `{ answer, citations, chunks }`.

## `src/agents/complianceAgent.ts`
- `complianceAgent(question)`
  - Wrapper around retrieval flow for compliance-centric usage.

## `src/agents/batchConfigAgent.ts`
- `batchConfigAgent(requirementText)`
  - Retrieves examples from vector store.
  - Prompts LLM to output strict JSON config.
  - Returns generated config and supporting examples.

## `src/agents/reportGenerationAgent.ts`
- `reportGenerationAgentPlaceholder()`
  - Placeholder for future report generation.

## `src/agents/incidentResolverAgent.ts`
- `incidentResolverAgentPlaceholder()`
  - Placeholder for incident lookup + resolution recommendation.

## `src/tools/ragSearch.ts`
- `ragSearchSchema`
  - Validates query input and topK.
- `ragSearch(input)`
  - Embeds query and performs vector similarity search.

## `src/tools/salesforceFetch.ts`
- `salesforceFetchSchema`
  - Placeholder request schema.
- `salesforceFetch()`
  - Placeholder implementation for future `jsforce` query.

## `src/rag/embeddingsFactory.ts`
- `EmbeddingsProvider` interface
  - Standard methods for query/doc embeddings.
- `XenovaEmbeddingsProvider`
  - Local model embeddings via transformers pipeline.
- `NomicEmbeddingsProvider`
  - Remote embedding API option.
- `createEmbeddingsProvider()`
  - Switches provider by `EMBEDDING_TYPE`.

## `src/rag/vectorStoreFactory.ts`
- `VectorStoreAdapter` interface
  - Adapter abstraction for upsert/similarity search.
- `VectraAdapter`
  - Working local vector DB integration.
- `ChromaPlaceholderAdapter`
  - Placeholder scaffold, currently fallback behavior.
- `PgVectorPlaceholderAdapter`
  - Placeholder scaffold, currently fallback behavior.
- `createVectorStore()`
  - Switches adapter by `VECTOR_DB_TYPE`.
- `buildChunkId(source, idx)`
  - Generates stable chunk IDs.

## `src/rag/ingest.ts`
- `chunkText(text, size, overlap)`
  - Sliding-window chunking.
- `extractText(filePath)`
  - File-type parsing for PDF/XLS/XLSX/DOC/DOCX/TXT.
- `ingestFile(filePath)`
  - Extract -> chunk -> embed -> upsert -> move to processed.
- `ingestDirectory(dir?)`
  - Batch ingestion for all files in folder.

## `src/graphs/mainGraph.ts`
- `detectIntentNode`
  - Classifies message route intent.
- `retrievalNode`
  - Executes retrieval agent.
- `chatNode`
  - Executes direct chat.
- `configNode`
  - Executes batch config generation.
- `runMainGraph(userInput)`
  - Graph entrypoint for app/API usage.

## `src/backroad/backroadApp.ts`
- `copyUploadToData(filePath)`
  - Copies uploaded file into ingestion folder.
- `startBackroadApp()`
  - Starts Backroad app and pages:
    - Chat
    - Ingest
    - Generate Config
  - Includes runtime-safe fallback if Backroad API signature differs.

## `src/mcp/ragMcpServer.ts`
- `startRagMcpServerPlaceholder()`
  - Placeholder for future dedicated RAG MCP server.

## `src/mcp/salesforceMcpServer.ts`
- `startSalesforceMcpServerPlaceholder()`
  - Placeholder for future Salesforce MCP server.

## `src/types.ts`
- Shared types/interfaces for graph state, citations, retrieval chunks, and router intent.

## `tests/supervisor.test.ts`
- Validates routing behavior:
  - policy -> retrieval
  - config text -> config
  - generic -> chat

---

## 4) Practical task examples

### Task: Add a new agent (e.g., report quality auditor)
1. Add `src/agents/reportQualityAgent.ts`.
2. Add node in `mainGraph.ts`.
3. Update `routeIntent()` to map relevant queries.
4. Add UI mode/page in Backroad if needed.
5. Add tests for routing and output schema.

### Task: Replace placeholder pgvector adapter with real implementation
1. Implement SQL table + vector column bootstrap.
2. Implement upsert with embeddings.
3. Implement similarity query with cosine distance.
4. Keep `VectorStoreAdapter` interface unchanged.

### Task: Add confidence-based fallback from retrieval -> chat
1. In `retrievalAgent`, inspect hit count/scores.
2. If insufficient, call `completeChat()` without retrieval context or with explicit uncertainty strategy.
3. Optionally include reason in output metadata.

---

## 5) Summary
- Current system already does RAG with LLM grounding in retrieval path.
- Routing is intentionally single-path per message.
- Architecture is modular so teams can extend agents, tools, and MCP services independently.
