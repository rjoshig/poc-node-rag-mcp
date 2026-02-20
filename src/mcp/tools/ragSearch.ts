import { z } from 'zod';
import { createEmbeddingsProvider } from '../../rag/embeddingsFactory';
import { createVectorStore } from '../../rag/vectorStoreFactory';
import { RetrievalChunk } from '../../types';
import { config } from '../../utils/config';
import { devLog } from '../../utils/devLog';

export const ragSearchSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().default(5)
});

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((word) => word.trim())
    .filter((word) => word.length > 1);
}

function lexicalOverlap(query: string, content: string): number {
  const queryTerms = Array.from(new Set(tokenize(query)));
  if (!queryTerms.length) return 0;
  const contentTerms = new Set(tokenize(content));
  const overlapCount = queryTerms.reduce((count, term) => count + (contentTerms.has(term) ? 1 : 0), 0);
  return overlapCount / queryTerms.length;
}

function rerankResults(query: string, chunks: RetrievalChunk[]): RetrievalChunk[] {
  const reranked = chunks
    .map((chunk) => {
      const vectorScore = Number.isFinite(chunk.score) ? chunk.score : 0;
      const lexicalScore = lexicalOverlap(query, chunk.content);
      const finalScore = vectorScore * 0.8 + lexicalScore * 0.2;
      return { ...chunk, score: Number(finalScore.toFixed(6)) };
    })
    .sort((a, b) => b.score - a.score);
  return reranked;
}

export async function ragSearch(input: z.infer<typeof ragSearchSchema>) {
  const parsed = ragSearchSchema.parse(input);
  devLog('rag.search', 'start', {
    embeddingType: config.embeddingType,
    vectorDbType: config.vectorDbType,
    topK: parsed.topK,
    queryChars: parsed.query.length
  });
  const embeddings = createEmbeddingsProvider();
  const store = createVectorStore();
  const queryEmbedding = await embeddings.embedQuery(parsed.query);
  devLog('rag.search', 'query embedding ready', { dims: queryEmbedding.length });
  const vectorResults = await store.similaritySearch(queryEmbedding, parsed.topK);
  const reranked = rerankResults(parsed.query, vectorResults);
  devLog('rag.search', 'results ready', {
    count: reranked.length,
    topScore: reranked[0]?.score ?? 0,
    preRerankTopScore: vectorResults[0]?.score ?? 0
  });
  return reranked;
}
