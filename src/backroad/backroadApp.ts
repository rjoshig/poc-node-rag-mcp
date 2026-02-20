import fs from 'node:fs/promises';
import path from 'node:path';
import { runMainGraph } from '../graphs/mainGraph';
import { ingestDirectory, ingestFile } from '../rag/ingest';
import { config } from '../utils/config';
import { mcpClient } from '../mcp/mcpClient';
import { devError, devLog } from '../utils/devLog';

// Backroad API is evolving; keep integration resilient with runtime capability checks.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backroad = require('@backroad/backroad');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startBackroadServer } = require('@backroad/backroad/src/lib/server');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sessionManager } = require('@backroad/backroad/src/lib/server/sessions/session-manager');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { socketEventHandlers } = require('@backroad/backroad/src/lib/server/server-socket-event-handlers');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SocketManager } = require('@backroad/backroad/src/lib/backroad/socket-manager');

async function copyUploadToData(filePath: string) {
  devLog('backroad.ingest', 'copy upload to data dir', { filePath });
  await fs.mkdir(config.dataDir, { recursive: true });
  const target = path.join(config.dataDir, path.basename(filePath));
  await fs.copyFile(filePath, target);
  devLog('backroad.ingest', 'upload copied', { target });
  return target;
}

function writeCodeBlock(ui: any, payload: unknown, language: string) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  ui.write({ body: `\`\`\`${language}\n${body}\n\`\`\`` });
}

function uploadedFilePath(file: any): string | null {
  if (!file || typeof file !== 'object') return null;
  if (typeof file.filepath === 'string') return file.filepath;
  if (typeof file.path === 'string') return file.path;
  return null;
}

function normalizeUploadedFiles(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.files)) return value.files;
  if (typeof value === 'object') {
    const objectValues = Object.values(value);
    const nestedArray = objectValues.find((v) => Array.isArray(v));
    if (Array.isArray(nestedArray)) return nestedArray;
  }
  return [];
}

async function startBackroadRunMode() {
  devLog('backroad.server', 'starting server', { port: config.backroadPort });
  const ns = await startBackroadServer({ port: config.backroadPort });
  devLog('backroad.server', 'namespace listener ready');
  ns.on('connection', async (socket: any) => {
    const backroadSession = sessionManager.getSession(socket.nsp.name.slice(1), { upsert: true });
    SocketManager.register(backroadSession.sessionId, socket);
    devLog('backroad.socket', 'client connected', {
      sessionId: backroadSession.sessionId,
      namespace: socket.nsp?.name
    });

    const runExecutor = async () => {
      const start = Date.now();
      devLog('backroad.render', 'runExecutor start', { sessionId: backroadSession.sessionId });
      backroadSession.resetTree();
      await renderBackroadPages(backroadSession.mainPageNodeManager);
      devLog('backroad.render', 'runExecutor done', { sessionId: backroadSession.sessionId, latencyMs: Date.now() - start });
    };

    const safeRunExecutor = async () => {
      try {
        await runExecutor();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        devError('backroad.render', 'runExecutor failed', msg);
        backroadSession.resetTree();
        const page = backroadSession.mainPageNodeManager;
        page.title({ label: 'Render Error' });
        page.write({ body: `Backroad render failed: ${msg}` });
      }
    };

    // Render once on connect, then retry once to avoid client-side connect race in Backroad v1.5.
    await safeRunExecutor();
    setTimeout(() => {
      void safeRunExecutor();
    }, 800);

    const setValueHandler = socketEventHandlers.setValue(socket, backroadSession, safeRunExecutor);
    socket.on('set_value', async (props: any, callback?: () => void) => {
      devLog('backroad.socket', 'set_value received', { sessionId: backroadSession.sessionId, id: props?.id });
      await setValueHandler(props, () => {
        if (typeof callback === 'function') callback();
      });
      devLog('backroad.socket', 'set_value handled', { sessionId: backroadSession.sessionId, id: props?.id });
    });

    const unsetValueHandler = socketEventHandlers.unsetValue(socket, backroadSession, safeRunExecutor);
    socket.on('unset_value', async (props: any, callback?: () => void) => {
      devLog('backroad.socket', 'unset_value received', { sessionId: backroadSession.sessionId, id: props?.id });
      await unsetValueHandler(props, () => {
        if (typeof callback === 'function') callback();
      });
      devLog('backroad.socket', 'unset_value handled', { sessionId: backroadSession.sessionId, id: props?.id });
    });

    socket.on('run_script', async (_args: any, callback?: () => void) => {
      devLog('backroad.socket', 'run_script received', { sessionId: backroadSession.sessionId });
      await safeRunExecutor();
      if (typeof callback === 'function') callback();
      socket.emit('running', null, () => {
        console.log('running event emitted');
      });
      devLog('backroad.socket', 'run_script handled', { sessionId: backroadSession.sessionId });
    });
    socket.on('disconnect', (reason: string) => {
      devLog('backroad.socket', 'client disconnected', { sessionId: backroadSession.sessionId, reason });
    });

    socket.emit('backroad_config', { server: { port: config.backroadPort } }, () => {
      console.log('sent backroad config to frontend');
      devLog('backroad.socket', 'backroad_config acked', { sessionId: backroadSession.sessionId });
    });
  });
  console.log(`Backroad app started on port ${config.backroadPort} (run mode)`);
}

async function renderBackroadPages(mainPage: any) {
  devLog('backroad.render', 'render pages start');
  const navItems = [
    { label: 'Chat', href: '/' },
    { label: 'Retrieval', href: '/retrieval' },
    { label: 'Ingest', href: '/ingest' },
    { label: 'Generate Config', href: '/generate-config' }
  ];

  mainPage.title({ label: 'Chat & Agent Router (MCP-backed)' });
  mainPage.linkGroup({ items: navItems });
  const prompt = mainPage.textInput({
    id: 'chat_prompt',
    label: 'Ask anything (policy/config/general):',
    placeholder: 'e.g. What is leave policy for probation employees?'
  });
  const chatResult = mainPage.getOrDefault('chat_result', null);
  if (mainPage.button({ id: 'chat_run_graph', label: 'Run Graph' })) {
    devLog('backroad.action', 'chat run graph clicked', { promptLength: prompt.length });
    const result = await runMainGraph(prompt);
    devLog('backroad.action', 'chat run graph result', {
      intent: result.intent,
      answerLength: result.answer?.length ?? 0,
      errorCount: result.errors?.length ?? 0
    });
    const payload = {
      intent: result.intent,
      answer: result.answer,
      generatedConfig: result.generatedConfig,
      citations: result.citations,
      errors: result.errors
    };
    mainPage.setValue('chat_result', payload);
  }
  if (chatResult) {
    if (chatResult.intent) mainPage.write({ body: `### Intent: ${chatResult.intent}` });
    if (chatResult.answer) mainPage.write({ body: String(chatResult.answer) });
    if (chatResult.generatedConfig) writeCodeBlock(mainPage, chatResult.generatedConfig, 'json');
    if (Array.isArray(chatResult.citations) && chatResult.citations.length) {
      mainPage.json({ src: chatResult.citations });
    }
    if (Array.isArray(chatResult.errors) && chatResult.errors.length) {
      mainPage.json({ src: { errors: chatResult.errors } });
    }
  }

  const retrievalPage = mainPage.page({ path: '/retrieval' });
  retrievalPage.title({ label: 'Retrieval + Grounded Answer (MCP rag.answer)' });
  retrievalPage.linkGroup({ items: navItems });
  const query = retrievalPage.textInput({
    id: 'retrieval_query',
    label: 'Query private knowledge base',
    placeholder: 'Ask a retrieval question'
  });
  const retrievalResult = retrievalPage.getOrDefault('retrieval_result', null);
  if (retrievalPage.button({ id: 'retrieval_run', label: 'Run Retrieval' })) {
    devLog('backroad.action', 'retrieval clicked', { query });
    const out = await mcpClient.ragAnswer({ query, topK: 5, fallbackToChat: true });
    devLog('backroad.action', 'retrieval response', {
      success: out.success,
      confidence: out.confidence,
      chunkCount: out.result?.chunks?.length ?? 0,
      errorCount: out.errors?.length ?? 0
    });
    retrievalPage.setValue('retrieval_result', out);
  }
  if (retrievalResult) {
    retrievalPage.json({ src: retrievalResult });
  }

  const ingestPage = mainPage.page({ path: '/ingest' });
  ingestPage.title({ label: 'Upload / Ingest Files' });
  ingestPage.linkGroup({ items: navItems });
  const uploadedFromComponent = ingestPage.fileUpload({
    id: 'ingest_upload',
    label: 'Upload PDF/TXT/DOCX/XLSX'
  });
  const uploadedFromState = ingestPage.getOrDefault('ingest_upload', []);
  const uploadedFiles = normalizeUploadedFiles(uploadedFromComponent).length
    ? normalizeUploadedFiles(uploadedFromComponent)
    : normalizeUploadedFiles(uploadedFromState);
  ingestPage.write({ body: `Uploaded files in session: ${uploadedFiles.length}` });
  const ingestResult = ingestPage.getOrDefault('ingest_result', null);

  if (ingestPage.button({ id: 'ingest_uploaded_file', label: 'Ingest Uploaded File' })) {
    devLog('backroad.action', 'ingest uploaded file clicked', { uploadedFiles: uploadedFiles.length });
    if (!uploadedFiles.length) {
      ingestPage.setValue('ingest_result', {
        message: 'No file uploaded yet. Click "Upload Files" first, then click "Ingest Uploaded File".',
        debug: {
          componentValueType: typeof uploadedFromComponent,
          stateValueType: typeof uploadedFromState
        }
      });
    } else {
      const sourcePath = uploadedFilePath(uploadedFiles[0]);
      if (!sourcePath) {
        ingestPage.setValue('ingest_result', {
          message: 'Upload received but file path was not found.',
          firstFile: uploadedFiles[0]
        });
      } else {
        devLog('backroad.action', 'ingest selected uploaded file', { sourcePath });
        const saved = await copyUploadToData(sourcePath);
        const result = await ingestFile(saved);
        devLog('backroad.action', 'ingest uploaded file result', result);
        ingestPage.setValue('ingest_result', result);
      }
    }
  }

  if (ingestPage.button({ id: 'ingest_data_folder', label: 'Ingest data/ folder' })) {
    devLog('backroad.action', 'ingest data folder clicked');
    const results = await ingestDirectory();
    devLog('backroad.action', 'ingest data folder result', { files: results.length });
    ingestPage.setValue('ingest_result', results);
  }
  if (ingestResult) {
    if (typeof ingestResult === 'object') ingestPage.json({ src: ingestResult });
    else ingestPage.write({ body: String(ingestResult) });
  }

  const configPage = mainPage.page({ path: '/generate-config' });
  configPage.title({ label: 'Generate Batch Config (MCP config.generate)' });
  configPage.linkGroup({ items: navItems });
  const instruction = configPage.textInput({
    id: 'cfg_instruction',
    label: 'Enter natural language rules',
    placeholder: 'if score < 7 reject'
  });
  const configResult = configPage.getOrDefault('config_result', null);
  const useRag = configPage.checkbox({
    id: 'cfg_use_rag',
    label: 'Use RAG examples',
    defaultValue: true
  });
  if (configPage.button({ id: 'cfg_generate', label: 'Generate' })) {
    devLog('backroad.action', 'config generate clicked', { instructionLength: instruction.length, useRag });
    const result = await mcpClient.configGenerate({ instruction, useRagContext: useRag, topK: 3 });
    devLog('backroad.action', 'config generate response', {
      success: result.success,
      chunkCount: result.result?.chunks?.length ?? 0,
      errorCount: result.errors?.length ?? 0
    });
    configPage.setValue('config_result', result);
  }
  if (configResult) {
    configPage.json({ src: configResult });
  }
  devLog('backroad.render', 'render pages end');
}

export async function startBackroadApp() {
  if (typeof backroad.createApp === 'function') {
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
    console.log(`Backroad app started on port ${config.backroadPort} (createApp mode)`);
    return;
  }

  if (typeof backroad.run === 'function') {
    await startBackroadRunMode();
    return;
  }

  console.log('Backroad createApp/run API not found. Falling back to CLI mode.');
}
