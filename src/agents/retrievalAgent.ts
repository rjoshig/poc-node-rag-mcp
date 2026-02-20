import { mcpClient } from '../mcp/mcpClient';

export async function retrievalAgent(query: string) {
  const response = await mcpClient.ragAnswer({ query, topK: 5, fallbackToChat: true });

  return {
    answer: response.result?.answer ?? 'No answer available.',
    citations: response.citations ?? [],
    chunks: response.result?.chunks ?? []
  };
}
