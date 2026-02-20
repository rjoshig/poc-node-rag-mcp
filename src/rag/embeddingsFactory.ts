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

class XaiEmbeddingsProvider implements EmbeddingsProvider {
  private endpoint() {
    return `${config.xaiEmbeddingBaseUrl.replace(/\/$/, '')}/embeddings`;
  }

  private async requestEmbeddings(input: string | string[]): Promise<number[][]> {
    const response = await fetch(this.endpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.xaiEmbeddingApiKey}`
      },
      body: JSON.stringify({
        model: config.xaiEmbeddingModel,
        input
      })
    });

    if (!response.ok) {
      throw new Error(`xAI embedding failed: ${response.status}`);
    }

    const data = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    return (data.data ?? []).map((row) => row.embedding ?? []);
  }

  async embedQuery(text: string): Promise<number[]> {
    const vectors = await this.requestEmbeddings(text);
    return vectors[0] ?? [];
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    return this.requestEmbeddings(texts);
  }
}

export function createEmbeddingsProvider(): EmbeddingsProvider {
  if (config.embeddingType === 'xai') {
    return new XaiEmbeddingsProvider();
  }
  if (config.embeddingType === 'nomic') {
    return new NomicEmbeddingsProvider();
  }
  return new XenovaEmbeddingsProvider();
}
