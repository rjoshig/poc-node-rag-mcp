import fs from 'node:fs/promises';
import path from 'node:path';
const pdfParse = require('pdf-parse');
import xlsx from 'xlsx';
import mammoth from 'mammoth';
import { createEmbeddingsProvider } from './embeddingsFactory';
import { buildChunkId, createVectorStore, VectorRecord } from './vectorStoreFactory';
import { config } from '../utils/config';
import { devError, devLog } from '../utils/devLog';

function chunkText(text: string, size = 1000, overlap = 150): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + size));
    i += Math.max(1, size - overlap);
  }
  return chunks;
}

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  devLog('ingest.extract', 'reading file', { filePath, ext });
  const fileBuffer = await fs.readFile(filePath);

  if (ext === '.pdf') {
    const parsed = await pdfParse(fileBuffer);
    return parsed.text;
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    return workbook.SheetNames.map((name) => xlsx.utils.sheet_to_csv(workbook.Sheets[name])).join('\n');
  }

  if (ext === '.docx' || ext === '.doc') {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  }

  return fileBuffer.toString('utf8');
}

export async function ingestFile(filePath: string): Promise<{ file: string; chunks: number }> {
  const startedAt = Date.now();
  devLog('ingest.file', 'start', { filePath });
  const text = await extractText(filePath);
  const chunks = chunkText(text);
  devLog('ingest.file', 'chunked', { filePath, textLength: text.length, chunks: chunks.length });
  if (!chunks.length) {
    devLog('ingest.file', 'skipped empty content', { filePath });
    return { file: filePath, chunks: 0 };
  }

  const embeddings = createEmbeddingsProvider();
  const vectorStore = createVectorStore();
  devLog('ingest.file', 'embedding documents', { filePath, chunkCount: chunks.length });
  const vectors = await embeddings.embedDocuments(chunks);
  devLog('ingest.file', 'embeddings ready', { filePath, vectorCount: vectors.length, vectorDims: vectors[0]?.length ?? 0 });

  const records: VectorRecord[] = chunks.map((content, idx) => ({
    id: buildChunkId(filePath, idx),
    content,
    source: filePath,
    embedding: vectors[idx] ?? [],
    metadata: { chunk: idx }
  }));

  await vectorStore.upsert(records);
  devLog('ingest.file', 'vectors upserted', { filePath, records: records.length });
  await fs.mkdir(config.processedDir, { recursive: true });
  const destination = path.join(config.processedDir, path.basename(filePath));
  await fs.rename(filePath, destination);
  devLog('ingest.file', 'moved to processed', { filePath, destination, latencyMs: Date.now() - startedAt });

  return { file: path.basename(filePath), chunks: chunks.length };
}

export async function ingestDirectory(dir = config.dataDir): Promise<Array<{ file: string; chunks: number }>> {
  devLog('ingest.dir', 'start', { dir });
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir);
  const files = entries
    .filter((name) => !name.startsWith('.'))
    .map((name) => path.join(dir, name))
    .filter((fullPath) => fullPath !== config.processedDir);
  devLog('ingest.dir', 'files discovered', { count: files.length, files });

  const results: Array<{ file: string; chunks: number }> = [];
  for (const filePath of files) {
    // eslint-disable-next-line no-await-in-loop
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) continue;
    // eslint-disable-next-line no-await-in-loop
    results.push(await ingestFile(filePath));
  }
  devLog('ingest.dir', 'complete', { dir, processed: results.length });
  return results;
}

if (require.main === module) {
  ingestDirectory()
    .then((res) => {
      console.log('Ingestion complete', res);
    })
    .catch((error) => {
      devError('ingest.dir', 'ingestion failed', error instanceof Error ? error.message : String(error));
      console.error('Ingestion failed', error);
      process.exit(1);
    });
}
