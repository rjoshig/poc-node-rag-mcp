# poc-node-rag-mcp

A lightweight pure Node.js POC that demonstrates:
- **RAG** (ingest PDF/text docs, chunk, embed, store vectors, retrieve top-k)
- **MCP-style tool calling** over HTTP (`/mcp`)
- **Grounded policy Q&A** (retrieve policy text + ask LLM for cited answer)
- **General LLM chat** (direct LLM interaction without retrieval)
- **Config generation** from plain English rules
- **Interactive CLI chat UI**

---

## 1) High-level design

This project is intentionally modular and easy to reason about:

1. **RAG Layer (`src/rag`)**
   - Reads files from `docs/`
   - Parses PDF/text
   - Splits into chunks
   - Generates embeddings
   - Stores/query vectors in local `vectra` index

2. **Tool Layer (`src/mcp/tools`)**
   - `retrieval`: semantic lookup + grounded LLM answer with citations
   - `configGenerator`: optional retrieval + LLM prompt -> JSON config

3. **MCP HTTP Layer (`src/mcp/server.js`)**
   - Exposes `POST /mcp` for tool invocation
   - Exposes `GET /health`

4. **UI Layer (`src/ui/chat-ui.js`)**
   - CLI prompt flow
   - Calls MCP tools via HTTP using axios

This separation lets you swap internals (embedding provider, vector DB, LLM endpoint) with minimal changes.

---

## 2) Embedding providers (switch by `.env` flag)

You can switch embedding backend by setting `EMBEDDING_PROVIDER` in `.env`:

- `natural` (default): local lightweight hash-based embedding via npm package `natural`
- `xenova`: local transformer embeddings via `@xenova/transformers` using `Xenova/all-MiniLM-L6-v2`
- `api`: calls your embedding endpoint (`LLM_API_BASE/embeddings`)

### Recommended defaults
- For no external dependency: `EMBEDDING_PROVIDER=natural`
- For higher-quality local embeddings: `EMBEDDING_PROVIDER=xenova`

> **Important:** If you change embedding provider after indexing, clear `vector-index/` and re-ingest docs to keep vector dimensions consistent.

---

## 3) Project structure and file responsibilities

```text
poc-node-rag-mcp/
├── src/
│   ├── config/
│   │   └── index.js              # Loads and exports env-driven config
│   ├── rag/
│   │   ├── index.js              # ingestDocument, ingestDocsFolder, retrieve, getIndex
│   │   └── utils.js              # chunkText helper
│   ├── mcp/
│   │   ├── server.js             # HTTP MCP gateway (/mcp, /health)
│   │   ├── tools/
│   │   │   ├── retrieval.js      # retrieval tool definition
│   │   │   ├── configGenerator.js# config generation tool definition
│   │   │   ├── chat.js           # general LLM chat tool
│   │   │   └── index.js          # allTools export
│   │   └── utils.js              # Zod schemas for tool input validation
│   ├── ui/
│   │   └── chat-ui.js            # CLI chatbot-like interface
│   ├── utils/
│   │   └── api.js                # embedText, localEmbed, xenovaEmbed, llmComplete
│   └── index.js                  # startup orchestration (optional ingest + start server)
├── docs/                         # input docs (pdf/txt/md)
├── vector-index/                 # local vectra index (gitignored)
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 4) Function-level explanation (easy map)

### `src/index.js`
- `ensureDirectories()`
  - Ensures `docs/` and `vector-index/` exist.
- `run()`
  - Reads `--ingest` flag.
  - Optionally ingests files.
  - Starts MCP HTTP server.

### `src/rag/index.js`
- `getIndex()`
  - Lazily initializes local `vectra` index.
- `parseDocument(filePath)`
  - Uses `pdf-parse` for PDFs; UTF-8 for text/markdown.
- `ingestDocument(filePath)`
  - Parse -> chunk -> embed -> insert each chunk to index.
- `ingestDocsFolder(folderPath)`
  - Finds supported files and ingests sequentially.
- `retrieve(query, topK)`
  - Embeds query and returns top matches.

### `src/utils/api.js`
- `localEmbed(text, dimensions)`
  - Tokenize + stem + hash into dense fixed vector, normalized.
- `xenovaEmbed(text)`
  - Uses `@xenova/transformers` feature extraction pipeline (`Xenova/all-MiniLM-L6-v2`).
- `embedText(input)`
  - Switches provider based on `EMBEDDING_PROVIDER` (`natural`, `xenova`, `api`).
- `llmComplete({ prompt, systemPrompt })`
  - Calls chat completion endpoint for config generation output.

### `src/mcp/server.js`
- `startMcpServer(port)`
  - Starts HTTP server.
  - Handles `POST /mcp` `{ tool, arguments }`.
  - Validates tool existence and executes tool handler.

### `src/mcp/tools/retrieval.js`
- `handler(args)`
  - Validates with Zod.
  - Calls `retrieve` to get top chunks.
  - Sends user query + retrieved policy text to LLM for grounded answer.
  - Returns `answer`, `citations`, and raw `results`.

### `src/mcp/tools/chat.js`
- `handler(args)`
  - Validates with Zod.
  - Sends user message directly to LLM for general chat response.

### `src/mcp/tools/configGenerator.js`
- `handler(args)`
  - Validates with Zod.
  - Optionally retrieves examples.
  - Prompts LLM to return strict JSON config.

### `src/ui/chat-ui.js`
- `run()`
  - CLI loop with `retrieval` / `config` modes.
  - Calls MCP endpoint and prints result.

---

## 5) Setup

### Prerequisites
- Node.js 18+

### Install
```bash
npm install
```

### Configure
```bash
cp .env.example .env
```

Edit `.env` as needed.

---

## 6) `.env` reference

```env
LLM_API_BASE=https://your-internal-llm-api.com
LLM_API_KEY=your-api-key
LLM_EMBED_MODEL=text-embedding-model
EMBEDDING_PROVIDER=natural
EMBEDDING_DIMENSIONS=256
XENOVA_MODEL=Xenova/all-MiniLM-L6-v2
LLM_CHAT_MODEL=chat-completion-model
MCP_PORT=3001
TOP_K=5
CHUNK_SIZE=500
CHUNK_OVERLAP=50
DOCS_DIR=./docs
VECTOR_INDEX_DIR=./vector-index
```

---

## 7) How to run

### Step A: Add documents
Place `.pdf`, `.txt`, or `.md` files in `docs/`.

### Step B: Ingest docs into vector index
```bash
npm run ingest
```

### Step C: Start MCP server
```bash
npm start
```

Health check:
```bash
curl http://localhost:3001/health
```

### Step D: Call tool manually
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool":"retrieval","arguments":{"query":"filter condition","topK":5}}'
```

### Step E: Launch CLI chat UI
```bash
npm run ui
```

Then choose mode:
- `retrieval` for policy answers grounded in documents (+ citations)
- `chat` for direct LLM conversation
- `config` for JSON config generation

---

## 8) Design rationale

- **Modular by domain**: `rag`, `mcp`, `ui`, and shared `utils` are isolated.
- **POC simplicity**: No frontend bundler and no heavyweight framework.
- **Swappable embeddings**: natural/xenova/api behind one function (`embedText`).
- **Swappable storage**: vectra is local; can be replaced later in `src/rag` without changing tools/UI contracts.
- **Validation-first tools**: Zod schemas prevent malformed tool calls.

---

## 9) Common troubleshooting

1. **`retrieval` returns poor results**
   - Re-ingest after changing embedding provider.
   - Increase `CHUNK_SIZE` or tune `TOP_K`.

2. **Xenova model load is slow first time**
   - First run downloads model artifacts; later runs are faster.

3. **Config generation fails**
   - Verify `LLM_API_BASE`, `LLM_API_KEY`, and chat model endpoint compatibility.

---

## 10) Scripts

- `npm start` → run MCP server
- `npm run ingest` → ingest docs then run server startup path
- `npm run ui` → start CLI UI (retrieval mode + direct LLM chat mode + config mode)


## 11) Grounded policy Q&A flow

When a user asks something like "What is the leave policy?":

1. `retrieval` tool embeds the question and fetches top policy chunks from vectordb.
2. The tool builds context blocks with citation IDs (`[C1]`, `[C2]`, ...).
3. It sends question + context to LLM with strict grounding instructions:
   - answer only from context
   - if unsure, clearly say so
   - include citations
4. Response is returned as `{ answer, citations, results }`.

This keeps the chatbot factual and auditable by pointing users to specific retrieved chunks.


## 12) Chat modes

This chatbot supports both requested experiences:

1. **Knowledge retrieval chat (`retrieval`)**
   - Uses RAG retrieval + LLM grounding with citations (`[C1]`, `[C2]`).
   - Best for policy/document Q&A.

2. **Direct LLM chat (`chat`)**
   - Sends the message directly to LLM without retrieval.
   - Best for open-ended assistance not tied to indexed docs.
