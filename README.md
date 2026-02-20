# poc-node-rag-mcp

## Project Overview
This repository is a modular Agentic RAG platform in Node.js/TypeScript using:
- **LangGraph.js** for supervisor routing and multi-agent execution.
- **MCP-ready architecture** for future decentralized tool servers.
- **Backroad UI** for chat, file ingestion, retrieval, and config-generation workflows.
- **Switchable embeddings** and **switchable vector store adapters**.
- **Internal OpenAI-compatible LLM** (`chatgpt-oss`) via `INTERNAL_LLM_BASE_URL` and `INTERNAL_LLM_API_KEY`.

## Architecture / Internal Working
1. User message enters `mainGraph` (`src/graphs/mainGraph.ts`).
2. Supervisor (`src/agents/supervisor.ts`) detects intent: `retrieval` / `chat` / `config`.
3. Routed agent executes:
   - `retrievalAgent`: RAG search + grounded answer with citations.
   - `batchConfigAgent`: rules-to-JSON generation with retrieved examples.
   - direct `chat`: general LLM response.
4. Backroad UI (`src/backroad/backroadApp.ts`) renders outputs.

### Current routing behavior
- The graph performs **one routed path per request**, not “always both”.
- If input appears policy/compliance-related, it routes to RAG retrieval.
- Otherwise it routes to direct chat.

## Setup
```bash
npm install
cp .env.example .env
```

For pgvector (if selected), ensure Postgres has extension:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Vector DB & Embeddings Setup
### Vector DB toggle
Set in `.env`:
- `VECTOR_DB_TYPE=chroma` (default)
- `VECTOR_DB_TYPE=pgvector`
- `VECTOR_DB_TYPE=vectra`

Current implementation:
- `vectra` is fully wired.
- `chroma` and `pgvector` adapters are scaffolded placeholders in `src/rag/vectorStoreFactory.ts` and currently fall back to vectra logic; swap in production clients there.

### Embedding toggle
Set in `.env`:
- `EMBEDDING_TYPE=xenova` (default, local)
- `EMBEDDING_TYPE=nomic` (remote/internal embedding API)

Factory is in `src/rag/embeddingsFactory.ts`.

## Running with Backroad
```bash
npm run dev
```
Then open Backroad app URL (port from `BACKROAD_PORT`, default `3000`).

UI pages:
- Chat (agent-router flow)
- Ingest (upload + ingest)
- Generate Config

## Ingestion Guide
### UI ingestion
Use Backroad **Ingest** page:
- upload PDF/TXT/DOCX/XLS/XLSX
- file is copied to `data/`
- parsed, chunked, embedded, written to vector store
- moved to `data/processed/`

### CLI ingestion fallback
```bash
npm run ingest
```
Scans `data/`, ingests supported files, then moves them to `data/processed/`.

## Usage Examples
- **General chat**: “Summarize what you can help with.”
- **Retrieval/policy**: “What is leave policy for probation employees?”
- **Config generation**: “If score < 7 reject consumer, else accept. If attr3 = 7 flag Y.”

## Future Agents
Placeholders are added:
- `src/agents/reportGenerationAgent.ts`
- `src/agents/incidentResolverAgent.ts`

Incident resolver note:
- ingest incident history/resolutions/error catalogs (JSON/CSV) into vector store,
- retrieve similar incidents during troubleshooting.

## Extending with MCP servers
Scaffold placeholders are in:
- `src/mcp/ragMcpServer.ts`
- `src/mcp/salesforceMcpServer.ts`

Teams can own/deploy separate MCP services and expose tools to the supervisor graph.

## Phases
1. **Phase 1 (current)**: Core LangGraph + Backroad + ingestion + local vector fallback.
2. **Phase 2**: Real Chroma/pgvector integrations and production MCP servers.
3. **Phase 3**: Human-in-the-loop approvals, durable state persistence, enterprise observability.
