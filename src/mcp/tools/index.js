const retrievalTool = require('./retrieval');
const configGeneratorTool = require('./configGenerator');

module.exports = {
  retrievalTool,
  configGeneratorTool,
  allTools: [retrievalTool, configGeneratorTool]
};
