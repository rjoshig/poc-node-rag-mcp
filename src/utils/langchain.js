const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');

const config = require('../config');

let chatModel;

function getChatModel() {
  if (!chatModel) {
    chatModel = new ChatOpenAI({
      model: config.chatModel,
      temperature: 0.2,
      apiKey: config.llmApiKey,
      configuration: {
        baseURL: config.llmApiBase
      }
    });
  }
  return chatModel;
}

async function langchainComplete({ systemPrompt, userPrompt }) {
  const promptTemplate = PromptTemplate.fromTemplate(
    `System Instruction:\n{systemPrompt}\n\nUser Prompt:\n{userPrompt}`
  );

  const chain = promptTemplate.pipe(getChatModel()).pipe(new StringOutputParser());

  return chain.invoke({
    systemPrompt: systemPrompt || 'You are a helpful assistant.',
    userPrompt
  });
}

module.exports = {
  langchainComplete
};
