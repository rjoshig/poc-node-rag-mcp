import { mcpClient } from '../mcp/mcpClient';

export async function batchConfigAgent(requirementText: string) {
  const response = await mcpClient.configGenerate({ instruction: requirementText, useRagContext: true, topK: 3 });
  return {
    generatedConfig: response.result?.generatedConfig ?? '',
    examples: response.result?.chunks ?? []
  };
}
