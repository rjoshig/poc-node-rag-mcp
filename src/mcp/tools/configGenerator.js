const { llmComplete } = require('../../utils/api');
const { retrieve } = require('../../rag');
const { configGeneratorInputSchema } = require('../utils');

const configGeneratorTool = {
  name: 'configGenerator',
  description: 'Convert plain text filtering rules into structured JSON config.',
  inputSchema: configGeneratorInputSchema,
  async handler(args) {
    const parsed = configGeneratorInputSchema.parse(args);
    const useExamples = parsed.useExamples !== false;

    let examplesText = 'No retrieval examples used.';
    if (useExamples) {
      const examples = await retrieve(parsed.instructions, parsed.topK || 3);
      examplesText = examples
        .map((item, idx) => `Example ${idx + 1} (score ${item.score.toFixed(4)}):\n${item.text}`)
        .join('\n\n');
    }

    const prompt = `Convert the user instructions into strict JSON using this shape:
{
  "waterfallFilters": [
    {
      "name": "filter name",
      "condition": "natural language condition",
      "onPass": "destination",
      "onFail": "destination"
    }
  ]
}

User Instructions:
${parsed.instructions}

Optional similar examples:
${examplesText}

Return only valid JSON.`;

    const completion = await llmComplete({
      systemPrompt: 'You transform workflow rules into deterministic JSON configs.',
      prompt
    });

    return {
      instructions: parsed.instructions,
      generatedConfig: completion
    };
  }
};

module.exports = configGeneratorTool;
