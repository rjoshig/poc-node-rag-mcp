import { z } from 'zod';
import { createEmbeddingsProvider } from '../rag/embeddingsFactory';
import { createVectorStore } from '../rag/vectorStoreFactory';

export const ragSearchSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().default(5)
});

export async function ragSearch(input: z.infer<typeof ragSearchSchema>) {
  const parsed = ragSearchSchema.parse(input);
  const embeddings = createEmbeddingsProvider();
  const store = createVectorStore();
  const queryEmbedding = await embeddings.embedQuery(parsed.query);
  return store.similaritySearch(queryEmbedding, parsed.topK);
}
