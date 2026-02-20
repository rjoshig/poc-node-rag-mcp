import { retrievalAgent } from './retrievalAgent';

export async function complianceAgent(question: string) {
  return retrievalAgent(question);
}
