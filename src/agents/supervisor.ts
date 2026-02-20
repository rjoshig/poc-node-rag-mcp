import { RouterIntent } from '../types';

export function routeIntent(input: string): RouterIntent {
  const lower = input.toLowerCase();
  if (lower.includes('config') || lower.includes('rule') || lower.includes('batch')) return 'config';
  if (lower.includes('policy') || lower.includes('compliance') || lower.includes('incident')) return 'retrieval';
  return 'chat';
}
