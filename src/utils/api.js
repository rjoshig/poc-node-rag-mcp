const crypto = require('crypto');
const axios = require('axios');
const natural = require('natural');
const config = require('../config');
const { langchainComplete } = require('./langchain');

const tokenizer = new natural.WordTokenizer();
let featureExtractorPromise;

const apiClient = axios.create({
  baseURL: config.llmApiBase,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.llmApiKey}`
  }
});

function localEmbed(text, dimensions = 256) {
  const vector = new Array(dimensions).fill(0);
  const tokens = tokenizer
    .tokenize(String(text || '').toLowerCase())
    .map((token) => natural.PorterStemmer.stem(token))
    .filter(Boolean);

  if (!tokens.length) return vector;

  for (const token of tokens) {
    const hash = crypto.createHash('sha256').update(token).digest();
    const idx = hash.readUInt16BE(0) % dimensions;
    const sign = hash[2] % 2 === 0 ? 1 : -1;
    vector[idx] += sign;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

async function getXenovaFeatureExtractor() {
  if (!featureExtractorPromise) {
    featureExtractorPromise = import('@xenova/transformers').then(({ pipeline }) => {
      console.log(`Loading Xenova embedding model: ${config.xenovaModel}`);
      return pipeline('feature-extraction', config.xenovaModel);
    });
  }
  return featureExtractorPromise;
}

async function xenovaEmbed(text) {
  const extractor = await getXenovaFeatureExtractor();
  const output = await extractor(String(text || ''), {
    pooling: 'mean',
    normalize: true
  });

  return Array.from(output.data);
}

async function embedWithApi(texts, isBatch) {
  const response = await apiClient.post('/embeddings', {
    model: config.embedModel,
    input: texts
  });
  const vectors = (response.data.data || []).map((item) => item.embedding);
  return isBatch ? vectors : vectors[0];
}

async function embedText(input) {
  const isBatch = Array.isArray(input);
  const texts = isBatch ? input : [input];

  if (config.embeddingProvider === 'api') {
    try {
      return await embedWithApi(texts, isBatch);
    } catch (error) {
      console.warn('API embedding failed, falling back to natural embeddings:', error.response?.data || error.message);
    }
  }

  if (config.embeddingProvider === 'xenova') {
    try {
      const vectors = [];
      for (const text of texts) {
        // eslint-disable-next-line no-await-in-loop
        vectors.push(await xenovaEmbed(text));
      }
      return isBatch ? vectors : vectors[0];
    } catch (error) {
      console.warn('Xenova embedding failed, falling back to natural embeddings:', error.message);
    }
  }

  const vectors = texts.map((text) => localEmbed(text, config.embeddingDimensions));
  return isBatch ? vectors : vectors[0];
}

async function llmComplete({ prompt, systemPrompt }) {
  if (config.useLangchain) {
    try {
      return await langchainComplete({
        systemPrompt,
        userPrompt: prompt
      });
    } catch (error) {
      console.warn('LangChain completion failed, falling back to direct API:', error.message);
    }
  }

  try {
    const response = await apiClient.post('/chat/completions', {
      model: config.chatModel,
      messages: [
        { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    });

    return response.data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('llmComplete failed:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  apiClient,
  embedText,
  llmComplete,
  localEmbed,
  xenovaEmbed
};
