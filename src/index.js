const fs = require('fs/promises');
const path = require('path');

const config = require('./config');
const { ingestDocsFolder } = require('./rag');
const { startMcpServer } = require('./mcp/server');

async function ensureDirectories() {
  await fs.mkdir(config.vectorIndexDir, { recursive: true });
  await fs.mkdir(config.docsDir, { recursive: true });
}

async function run() {
  await ensureDirectories();

  const shouldIngest = process.argv.includes('--ingest');

  if (shouldIngest) {
    console.log('Starting ingestion from docs folder:', config.docsDir);
    const files = await fs.readdir(config.docsDir);
    if (!files.length) {
      console.warn(`No files found in ${config.docsDir}. Add .pdf/.txt/.md files first.`);
    } else {
      const result = await ingestDocsFolder(config.docsDir);
      console.log('Ingestion complete:', result);
    }
  }

  startMcpServer(config.mcpPort);
  console.log('Startup complete.');
  console.log(`Try curl: curl -X POST http://localhost:${config.mcpPort}/mcp -H "Content-Type: application/json" -d '{"tool":"retrieval","arguments":{"query":"sample"}}'`);
}

run().catch((error) => {
  console.error('Fatal startup error:', error.message);
  process.exit(1);
});
