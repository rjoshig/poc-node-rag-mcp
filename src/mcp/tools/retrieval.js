const { retrieve } = require('../../rag');
const { retrievalInputSchema } = require('../utils');

const retrievalTool = {
  name: 'retrieval',
  description: 'Retrieve semantically similar chunks from the vector store.',
  inputSchema: retrievalInputSchema,
  async handler(args) {
    const parsed = retrievalInputSchema.parse(args);
    const results = await retrieve(parsed.query, parsed.topK);
    return {
      query: parsed.query,
      results
    };
  }
};

module.exports = retrievalTool;
