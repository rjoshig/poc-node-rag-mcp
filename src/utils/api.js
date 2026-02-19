const axios = require('axios');
const config = require('../config');

const apiClient = axios.create({
  baseURL: config.llmApiBase,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.llmApiKey}`
  }
});

async function embedText(input) {
  try {
    const text = Array.isArray(input) ? input : [input];
    const response = await apiClient.post('/embeddings', {
      model: config.embedModel,
      input: text
    });

    const vectors = (response.data.data || []).map((item) => item.embedding);
    return Array.isArray(input) ? vectors : vectors[0];
  } catch (error) {
    console.error('embedText failed:', error.response?.data || error.message);
    throw error;
  }
}

async function llmComplete({ prompt, systemPrompt }) {
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
  llmComplete
};
