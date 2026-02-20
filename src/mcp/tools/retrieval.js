const { retrieve } = require('../../rag');
const { llmComplete } = require('../../utils/api');
const { retrievalInputSchema } = require('../utils');

function buildContext(results) {
  return results
    .map((item, idx) => {
      const citationId = `C${idx + 1}`;
      return `[${citationId}] source=${item.source || 'unknown'} chunk=${item.chunkId}\n${item.text}`;
    })
    .join('\n\n');
}

function buildCitations(results) {
  return results.map((item, idx) => ({
    id: `C${idx + 1}`,
    source: item.source,
    chunkId: item.chunkId,
    score: item.score
  }));
}

async function generateGroundedAnswer(query, results) {
  if (!results.length) {
    return 'I could not find relevant policy text in the indexed documents.';
  }

  const context = buildContext(results);

  const prompt = `You are a policy assistant. Answer the user using only the provided policy context.

Rules:
1) If the context is insufficient, reply: "I am not sure based on the available policy context."
2) If you answer, keep it clear and concise.
3) Include 1-3 inline citations like [C1], [C2] that map to the supplied context blocks.
4) Do not invent policy details that are missing from context.

User question:
${query}

Policy context:
${context}`;

  return llmComplete({
    systemPrompt: 'You answer strictly from retrieved company policy context and cite it.',
    prompt
  });
}

const retrievalTool = {
  name: 'retrieval',
  description: 'Retrieve semantically similar chunks and optionally generate a grounded answer with citations.',
  inputSchema: retrievalInputSchema,
  async handler(args) {
    const parsed = retrievalInputSchema.parse(args);
    const generateAnswer = parsed.generateAnswer !== false;
    const results = await retrieve(parsed.query, parsed.topK);

    let answer = null;
    if (generateAnswer) {
      try {
        answer = await generateGroundedAnswer(parsed.query, results);
      } catch (error) {
        console.error('Grounded answer generation failed:', error.message);
        answer = 'I am not sure based on the available policy context.';
      }
    }

    return {
      query: parsed.query,
      answer,
      citations: buildCitations(results),
      results
    };
  }
};

module.exports = retrievalTool;
