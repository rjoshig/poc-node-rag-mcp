const { llmComplete } = require('../../utils/api');
const { chatInputSchema } = require('../utils');

const chatTool = {
  name: 'chat',
  description: 'General chat with LLM without retrieval context.',
  inputSchema: chatInputSchema,
  async handler(args) {
    const parsed = chatInputSchema.parse(args);
    const answer = await llmComplete({
      systemPrompt: parsed.systemPrompt || 'You are a helpful assistant.',
      prompt: parsed.message
    });

    return {
      message: parsed.message,
      answer
    };
  }
};

module.exports = chatTool;
