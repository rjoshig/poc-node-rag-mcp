import { completeChat } from '../utils/llm';
import { ragSearch } from '../tools/ragSearch';

export async function retrievalAgent(query: string) {
  const hits = await ragSearch({ query, topK: 5 });
  const context = hits.map((h, i) => `[C${i + 1}] (${h.source}) ${h.content}`).join('\n\n');

  const answer = await completeChat({
    system:
      'You are a compliance policy assistant. Use only provided context, cite [C#], and state uncertainty when context is insufficient.',
    user: `User question: ${query}\n\nRetrieved context:\n${context}`
  });

  return {
    answer,
    citations: hits.map((h, i) => ({ id: `C${i + 1}`, source: h.source, score: h.score })),
    chunks: hits
  };
}
