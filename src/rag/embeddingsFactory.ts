import { pipeline } from '@xenova/transformers';
import { config } from '../utils/config';

export interface EmbeddingsProvider {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

class XenovaEmbeddingsProvider implements EmbeddingsProvider {
  private extractorPromise?: ReturnType<typeof pipeline>;

  private async getExtractor() {
    if (!this.extractorPromise) {
      this.extractorPromise = pipeline('feature-extraction', config.xenovaModel);
    }
    return this.extractorPromise;
  }

  async embedQuery(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const out: any = await extractor(text, { pooling: 'mean', normalize: true } as any);
    return Array.from((out?.data ?? []) as Float32Array);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (const text of texts) {
      // eslint-disable-next-line no-await-in-loop
      vectors.push(await this.embedQuery(text));
    }
    return vectors;
  }
}

class NomicEmbeddingsProvider implements EmbeddingsProvider {
  async embedQuery(text: string): Promise<number[]> {
    const response = await fetch(config.nomicEmbeddingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.nomicEmbeddingApiKey}`
      },
      body: JSON.stringify({ input: text })
    });

    if (!response.ok) {
      throw new Error(`Nomic embedding failed: ${response.status}`);
    }

    const data = (await response.json()) as { embedding?: number[] };
    return data.embedding ?? [];
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (const text of texts) {
      // eslint-disable-next-line no-await-in-loop
      vectors.push(await this.embedQuery(text));
    }
    return vectors;
  }
}

export function createEmbeddingsProvider(): EmbeddingsProvider {
  if (config.embeddingType === 'nomic') {
    return new NomicEmbeddingsProvider();
  }
  return new XenovaEmbeddingsProvider();
}
