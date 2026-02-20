const readline = require('readline');
const axios = require('axios');

const MCP_URL = 'http://localhost:3001/mcp';

async function callTool(tool, args) {
  const response = await axios.post(MCP_URL, { tool, arguments: args });
  return response.data.result;
}

function printCitations(citations = []) {
  if (!citations.length) return;
  console.log('\nCitations:');
  citations.slice(0, 5).forEach((c) => {
    console.log(`- [${c.id}] source=${c.source || 'unknown'} chunk=${c.chunkId} score=${Number(c.score || 0).toFixed(4)}`);
  });
}

async function run() {
  console.log('=== poc-node-rag-mcp CLI Chat UI ===');
  console.log('Type mode as "retrieval" or "config". Type "exit" anytime to quit.');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  while (true) {
    const mode = (await ask('\nMode (retrieval/config): ')).trim().toLowerCase();
    if (mode === 'exit') break;

    const text = (await ask('Input: ')).trim();
    if (text.toLowerCase() === 'exit') break;

    try {
      if (mode === 'config') {
        const result = await callTool('configGenerator', { instructions: text, useExamples: true });
        console.log('\nAssistant (config JSON):\n', result.generatedConfig);
      } else {
        const result = await callTool('retrieval', { query: text, topK: 5, generateAnswer: true });
        console.log('\nAssistant (policy answer):\n', result.answer || 'No answer generated.');
        printCitations(result.citations);

        console.log('\nRetrieved Chunks (debug):');
        (result.results || []).forEach((item, i) => {
          console.log(`${i + 1}. [score=${item.score}] ${item.text}`);
        });
      }
    } catch (error) {
      console.error('Request failed:', error.response?.data || error.message);
    }
  }

  rl.close();
  console.log('UI session closed.');
}

if (require.main === module) {
  run();
}

module.exports = { run };
