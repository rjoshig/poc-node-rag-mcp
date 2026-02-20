import { pipeline } from '@xenova/transformers';
import { config } from '../utils/config';
import { devLog } from '../utils/devLog';

export interface EmbeddingsProvider {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

class XenovaEmbeddingsProvider implements EmbeddingsProvider {
  private extractorPromise?: ReturnType<typeof pipeline>;

  private async getExtractor() {
    if (!this.extractorPromise) {
      devLog('embedding.xenova', 'loading extractor model', { model: config.xenovaModel });
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

export function createEmbeddingsProvider(): EmbeddingsProvider {
  devLog('embedding', 'provider selected', { provider: 'xenova', model: config.xenovaModel });
  return new XenovaEmbeddingsProvider();
}
