export type RouterIntent = 'retrieval' | 'chat' | 'config';

export interface Citation {
  id: string;
  source: string;
  score: number;
}

export interface RetrievalChunk {
  id: string;
  content: string;
  source: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface GraphState {
  userInput: string;
  intent?: RouterIntent;
  answer?: string;
  retrievalQuery?: string;
  routeReason?: string;
  routeConfidence?: number;
  retrievalProbeConfidence?: number;
  citations?: Citation[];
  chunks?: RetrievalChunk[];
  generatedConfig?: string;
  errors?: string[];
}
