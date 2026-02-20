import { completeChat } from '../utils/llm';
import { ragSearch } from '../tools/ragSearch';

export async function batchConfigAgent(requirementText: string) {
  const examples = await ragSearch({ query: requirementText, topK: 3 });
  const context = examples.map((x, i) => `Example ${i + 1}: ${x.content}`).join('\n');

  const generatedConfig = await completeChat({
    system: 'Generate strict JSON batch configuration records based on instruction and compliance examples.',
    user: `Instruction:\n${requirementText}\n\nReference:\n${context}\n\nReturn valid JSON only.`
  });

  return { generatedConfig, examples };
}
