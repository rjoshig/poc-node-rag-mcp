const retrievalTool = require('./retrieval');
const configGeneratorTool = require('./configGenerator');
const chatTool = require('./chat');

module.exports = {
  retrievalTool,
  configGeneratorTool,
  chatTool,
  allTools: [retrievalTool, configGeneratorTool, chatTool]
};
