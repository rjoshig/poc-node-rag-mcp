import fs from 'node:fs/promises';
import path from 'node:path';
const pdfParse = require('pdf-parse');
import xlsx from 'xlsx';
import mammoth from 'mammoth';
import { createEmbeddingsProvider } from './embeddingsFactory';
import { buildChunkId, createVectorStore, VectorRecord } from './vectorStoreFactory';
import { config } from '../utils/config';

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
  const text = await extractText(filePath);
  const chunks = chunkText(text);
  if (!chunks.length) return { file: filePath, chunks: 0 };

  const embeddings = createEmbeddingsProvider();
  const vectorStore = createVectorStore();
  const vectors = await embeddings.embedDocuments(chunks);

  const records: VectorRecord[] = chunks.map((content, idx) => ({
    id: buildChunkId(filePath, idx),
    content,
    source: filePath,
    embedding: vectors[idx] ?? [],
    metadata: { chunk: idx }
  }));

  await vectorStore.upsert(records);
  await fs.mkdir(config.processedDir, { recursive: true });
  const destination = path.join(config.processedDir, path.basename(filePath));
  await fs.rename(filePath, destination);

  return { file: path.basename(filePath), chunks: chunks.length };
}

export async function ingestDirectory(dir = config.dataDir): Promise<Array<{ file: string; chunks: number }>> {
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir);
  const files = entries
    .filter((name) => !name.startsWith('.'))
    .map((name) => path.join(dir, name))
    .filter((fullPath) => fullPath !== config.processedDir);

  const results: Array<{ file: string; chunks: number }> = [];
  for (const filePath of files) {
    // eslint-disable-next-line no-await-in-loop
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) continue;
    // eslint-disable-next-line no-await-in-loop
    results.push(await ingestFile(filePath));
  }
  return results;
}

if (require.main === module) {
  ingestDirectory()
    .then((res) => {
      console.log('Ingestion complete', res);
    })
    .catch((error) => {
      console.error('Ingestion failed', error);
      process.exit(1);
    });
}
