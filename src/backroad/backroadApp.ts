import fs from 'node:fs/promises';
import path from 'node:path';
import { runMainGraph } from '../graphs/mainGraph';
import { ingestDirectory, ingestFile } from '../rag/ingest';
import { config } from '../utils/config';
import { mcpClient } from '../mcp/mcpClient';

// Backroad API is evolving; keep integration resilient with runtime capability checks.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backroad = require('@backroad/backroad');

async function copyUploadToData(filePath: string) {
  await fs.mkdir(config.dataDir, { recursive: true });
  const target = path.join(config.dataDir, path.basename(filePath));
  await fs.copyFile(filePath, target);
  return target;
}

export async function startBackroadApp() {
  if (typeof backroad.createApp !== 'function') {
    console.log('Backroad createApp API not found. Falling back to CLI mode.');
    return;
  }

  const app = backroad.createApp({ title: 'Agentic RAG Platform', port: config.backroadPort });

  app.page('Chat', async (ui: any) => {
    ui.markdown('## Chat & Agent Router (MCP-backed)');
    const prompt = await ui.textInput('Ask anything (policy/config/general):');
    if (await ui.button('Run Graph')) {
      const result = await runMainGraph(prompt);
      ui.markdown(`### Intent: ${result.intent}`);
      if (result.answer) ui.markdown(result.answer);
      if (result.generatedConfig) ui.code(result.generatedConfig, 'json');
      if (result.citations?.length) ui.json(result.citations);
      if (result.errors?.length) ui.json({ errors: result.errors });
    }
  });

  app.page('Retrieval', async (ui: any) => {
    ui.markdown('## Retrieval + Grounded Answer (MCP rag.answer)');
    const query = await ui.textInput('Query private knowledge base');
    if (await ui.button('Run Retrieval')) {
      const out = await mcpClient.ragAnswer({ query, topK: 5, fallbackToChat: true });
      ui.json(out);
    }
  });

  app.page('Ingest', async (ui: any) => {
    ui.markdown('## Upload / Ingest Files');
    const uploaded = await ui.fileUpload('Upload PDF/TXT/DOCX/XLSX');
    if (uploaded && uploaded.path) {
      const saved = await copyUploadToData(uploaded.path);
      const result = await ingestFile(saved);
      ui.json(result);
    }

    if (await ui.button('Ingest data/ folder')) {
      const results = await ingestDirectory();
      ui.json(results);
    }
  });

  app.page('Generate Config', async (ui: any) => {
    ui.markdown('## Generate Batch Config (MCP config.generate)');
    const prompt = await ui.textArea('Enter natural language rules');
    const useRag = await ui.checkbox('Use RAG examples', true);
    if (await ui.button('Generate')) {
      const result = await mcpClient.configGenerate({ instruction: prompt, useRagContext: useRag, topK: 3 });
      ui.json(result);
    }
  });

  await app.start();
  console.log(`Backroad app started on port ${config.backroadPort}`);
}
