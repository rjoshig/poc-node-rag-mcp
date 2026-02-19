const fs = require('fs/promises');
const path = require('path');
const pdfParse = require('pdf-parse');
const { LocalIndex } = require('vectra');

const config = require('../config');
const { chunkText } = require('./utils');
const { embedText } = require('../utils/api');

let indexInstance;

async function getIndex() {
  if (!indexInstance) {
    indexInstance = new LocalIndex(config.vectorIndexDir);
    const exists = await indexInstance.isIndexCreated();
    if (!exists) {
      console.log('Creating vector index at', config.vectorIndexDir);
      await indexInstance.createIndex();
    }
  }
  return indexInstance;
}

async function parseDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);
  if (ext === '.pdf') {
    const parsed = await pdfParse(buffer);
    return parsed.text || '';
  }
  return buffer.toString('utf-8');
}

async function ingestDocument(filePath) {
  console.log('Ingesting document:', filePath);
  const text = await parseDocument(filePath);
  const chunks = chunkText(text, config.chunkSize, config.chunkOverlap);
  const index = await getIndex();

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const vector = await embedText(chunk);

    await index.insertItem({
      vector,
      metadata: {
        source: filePath,
        chunkId: i,
        text: chunk
      }
    });

    if (i % 25 === 0) {
      console.log(`Indexed chunk ${i + 1}/${chunks.length}`);
    }
  }

  console.log(`Completed ingest: ${chunks.length} chunks from ${filePath}`);
  return { filePath, chunks: chunks.length };
}

async function ingestDocsFolder(folderPath = config.docsDir) {
  const dirItems = await fs.readdir(folderPath);
  const files = dirItems
    .filter((file) => ['.pdf', '.txt', '.md'].includes(path.extname(file).toLowerCase()))
    .map((file) => path.join(folderPath, file));

  const results = [];
  for (const filePath of files) {
    // Sequential for API-rate safety in POC.
    // eslint-disable-next-line no-await-in-loop
    results.push(await ingestDocument(filePath));
  }

  return results;
}

async function retrieve(query, topK = config.topK) {
  const index = await getIndex();
  const queryVector = await embedText(query);
  const hits = await index.queryItems(queryVector, topK);

  return hits.map((hit) => ({
    score: hit.score,
    source: hit.item.metadata?.source,
    chunkId: hit.item.metadata?.chunkId,
    text: hit.item.metadata?.text
  }));
}

module.exports = {
  ingestDocument,
  ingestDocsFolder,
  retrieve,
  getIndex
};
