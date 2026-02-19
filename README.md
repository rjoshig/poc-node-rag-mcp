# poc-node-rag-mcp

A lightweight **Node.js POC** that demonstrates:

- Retrieval-Augmented Generation (RAG) over local docs/PDFs
- MCP-style tool endpoints for retrieval and config generation
- A simple CLI chatbot interface

## Project Structure

```text
poc-node-rag-mcp/
├── src/
│   ├── config/
│   │   └── index.js
│   ├── rag/
│   │   ├── index.js
│   │   └── utils.js
│   ├── mcp/
│   │   ├── server.js
│   │   ├── tools/
│   │   │   ├── retrieval.js
│   │   │   ├── configGenerator.js
│   │   │   └── index.js
│   │   └── utils.js
│   ├── ui/
│   │   └── chat-ui.js
│   ├── utils/
│   │   └── api.js
│   └── index.js
├── vector-index/
├── docs/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Setup

1. Install dependencies locally:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env
```

3. Update `.env` with your internal LLM API settings.

## Run

### 1) Optional: Ingest docs first

Put sample `.pdf`, `.txt`, or `.md` files in `docs/`, then run:

```bash
npm run ingest
```

### 2) Start MCP server

```bash
npm start
```

Server runs on `http://localhost:3001` by default.

Tool endpoint:

```bash
POST http://localhost:3001/mcp
```

Payload format:

```json
{
  "tool": "retrieval",
  "arguments": {
    "query": "What does the document say about filters?",
    "topK": 5
  }
}
```

### 3) Launch CLI UI

```bash
npm run ui
```

CLI script path: `src/ui/chat-ui.js`.

## Notes

- `vector-index/` is local and git-ignored.
- `.env` is git-ignored.
- This is intentionally simple and modular for POC purposes.
