import fs from 'node:fs/promises';
import path from 'node:path';
import { LocalIndex } from 'vectra';
import { config } from '../utils/config';
import { RetrievalChunk } from '../types';
import { devLog } from '../utils/devLog';

const { Pool } = require('pg') as { Pool: new (options: { connectionString: string }) => any };

function redactConnectionString(raw: string): string {
  try {
    const parsed = new URL(raw);
    if (parsed.password) parsed.password = '***';
    if (parsed.username) parsed.username = '***';
    return parsed.toString();
  } catch {
    return '<invalid-connection-string>';
  }
}

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

class ChromaPlaceholderAdapter implements VectorStoreAdapter {
  // Placeholder adapter for chroma integration using @langchain/community.
  // Production: wire Chroma client and collection persistence.
  private fallback = new VectraAdapter();
  async upsert(records: VectorRecord[]): Promise<void> {
    return this.fallback.upsert(records);
  }
  async similaritySearch(queryVector: number[], topK: number): Promise<RetrievalChunk[]> {
    return this.fallback.similaritySearch(queryVector, topK);
  }
}

class PgVectorAdapter implements VectorStoreAdapter {
  private pool: any = new Pool({ connectionString: config.pgvectorConnectionString });
  private schemaInitPromise?: Promise<void>;

  private async ensureSchema(): Promise<void> {
    if (!this.schemaInitPromise) {
      this.schemaInitPromise = (async () => {
        devLog('vector.pgvector', 'initializing schema', { table: 'rag_chunks' });
        const client = await this.pool.connect();
        try {
          await client.query('CREATE EXTENSION IF NOT EXISTS vector');
          await client.query(`
            CREATE TABLE IF NOT EXISTS rag_chunks (
              id TEXT PRIMARY KEY,
              content TEXT NOT NULL,
              source TEXT NOT NULL,
              metadata JSONB,
              embedding VECTOR NOT NULL
            )
          `);
        } finally {
          client.release();
        }
      })();
    }
    return this.schemaInitPromise;
  }

  private toPgVector(embedding: number[]): string {
    if (!embedding.length) {
      throw new Error('Embedding vector cannot be empty.');
    }

    const sanitized = embedding.map((n) => {
      if (!Number.isFinite(n)) {
        throw new Error('Embedding vector contains non-finite values.');
      }
      return Number(n);
    });

    return `[${sanitized.join(',')}]`;
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    if (!records.length) return;
    await this.ensureSchema();
    devLog('vector.pgvector', 'upsert start', {
      records: records.length,
      connection: redactConnectionString(config.pgvectorConnectionString)
    });

    for (const record of records) {
      // eslint-disable-next-line no-await-in-loop
      await this.pool.query(
        `
          INSERT INTO rag_chunks (id, content, source, metadata, embedding)
          VALUES ($1, $2, $3, $4, $5::vector)
          ON CONFLICT (id)
          DO UPDATE SET
            content = EXCLUDED.content,
            source = EXCLUDED.source,
            metadata = EXCLUDED.metadata,
            embedding = EXCLUDED.embedding
        `,
        [
          record.id,
          record.content,
          record.source,
          JSON.stringify(record.metadata ?? {}),
          this.toPgVector(record.embedding)
        ]
      );
    }
  }

  async similaritySearch(queryVector: number[], topK: number): Promise<RetrievalChunk[]> {
    await this.ensureSchema();

    const limit = Number.isFinite(topK) ? Math.max(1, Math.floor(topK)) : 5;
    const queryDims = queryVector.length;
    devLog('vector.pgvector', 'similarity search', {
      connection: redactConnectionString(config.pgvectorConnectionString),
      topK: limit,
      dims: queryDims
    });
    const result = await this.pool.query(
      `
        SELECT
          id,
          content,
          source,
          metadata,
          (1 - (embedding <=> $1::vector))::float8 AS score
        FROM rag_chunks
        WHERE vector_dims(embedding) = $3
        ORDER BY embedding <=> $1::vector
        LIMIT $2
      `,
      [this.toPgVector(queryVector), limit, queryDims]
    );

    return result.rows.map((row: any) => ({
      id: String(row.id),
      content: String(row.content ?? ''),
      source: String(row.source ?? 'unknown'),
      score: Number(row.score ?? 0),
      metadata: (row.metadata ?? {}) as Record<string, unknown>
    }));
  }
}

export function createVectorStore(): VectorStoreAdapter {
  if (config.vectorDbType === 'pgvector') {
    devLog('vector', 'adapter selected', { adapter: 'pgvector' });
    return new PgVectorAdapter();
  }
  if (config.vectorDbType === 'chroma') {
    devLog('vector', 'adapter selected', { adapter: 'chroma (vectra fallback)' });
    return new ChromaPlaceholderAdapter();
  }
  devLog('vector', 'adapter selected', { adapter: 'vectra' });
  return new VectraAdapter();
}

export function buildChunkId(source: string, idx: number): string {
  return `${path.basename(source)}::${idx}`;
}
