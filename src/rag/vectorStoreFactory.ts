import fs from 'node:fs/promises';
import path from 'node:path';
import { LocalIndex } from 'vectra';
import { config } from '../utils/config';
import { RetrievalChunk } from '../types';
import { devLog } from '../utils/devLog';

export interface VectorRecord {
  id: string;
  content: string;
  source: string;
  metadata?: Record<string, unknown>;
  embedding: number[];
}

export interface VectorStoreAdapter {
  upsert(records: VectorRecord[]): Promise<void>;
  similaritySearch(queryVector: number[], topK: number): Promise<RetrievalChunk[]>;
}

class VectraAdapter implements VectorStoreAdapter {
  private index: LocalIndex;
  constructor() {
    this.index = new LocalIndex(config.vectraIndexDir);
  }

  private async ensureIndex() {
    await fs.mkdir(config.vectraIndexDir, { recursive: true });
    if (!(await this.index.isIndexCreated())) {
      await this.index.createIndex();
    }
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    await this.ensureIndex();
    devLog('vector.vectra', 'upsert start', { records: records.length });
    for (const record of records) {
      // eslint-disable-next-line no-await-in-loop
      await this.index.insertItem({
        vector: record.embedding,
        metadata: {
          id: record.id,
          content: record.content,
          source: record.source,
          ...(record.metadata ?? {})
        }
      });
    }
  }

  async similaritySearch(queryVector: number[], topK: number): Promise<RetrievalChunk[]> {
    await this.ensureIndex();
    devLog('vector.vectra', 'similarity search', { topK, dims: queryVector.length });
    const hits = await this.index.queryItems(queryVector, "", topK);
    return hits.map((hit, i) => ({
      id: String(hit.item.metadata?.id ?? i),
      content: String(hit.item.metadata?.content ?? ''),
      source: String(hit.item.metadata?.source ?? 'unknown'),
      score: hit.score,
      metadata: hit.item.metadata
    }));
  }
}

export function createVectorStore(): VectorStoreAdapter {
  devLog('vector', 'adapter selected', { adapter: 'vectra' });
  return new VectraAdapter();
}

export function buildChunkId(source: string, idx: number): string {
  return `${path.basename(source)}::${idx}`;
}
