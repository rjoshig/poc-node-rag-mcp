import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { routeRequest } from '../agents/supervisor';
import { mcpClient } from '../mcp/mcpClient';
import { devError, devLog } from '../utils/devLog';

const GraphAnnotation = Annotation.Root({
  userInput: Annotation<string>,
  intent: Annotation<'retrieval' | 'chat' | 'config'>,
  answer: Annotation<string>,
  generatedConfig: Annotation<string>,
  retrievalQuery: Annotation<string>,
  routeReason: Annotation<string>,
  routeConfidence: Annotation<number>,
  retrievalProbeConfidence: Annotation<number>,
  citations: Annotation<any[]>,
  chunks: Annotation<any[]>,
  errors: Annotation<string[]>
});

const detectIntentNode = async (state: typeof GraphAnnotation.State) => {
  devLog('graph.detectIntent', 'routing input', { inputLength: state.userInput.length, inputPreview: state.userInput.slice(0, 180) });
  const decision = await routeRequest(state.userInput);
  devLog('graph.detectIntent', 'route selected', {
    intent: decision.intent,
    confidence: decision.confidence,
    reason: decision.reason,
    retrievalQuery: decision.retrievalQuery,
    retrievalProbe: decision.retrievalProbe
  });
  return {
    ...state,
    intent: decision.intent,
    retrievalQuery: decision.retrievalQuery,
    routeReason: decision.reason,
    routeConfidence: decision.confidence,
    retrievalProbeConfidence: decision.retrievalProbe.confidence
  };
};

const retrievalNode = async (state: typeof GraphAnnotation.State) => {
  devLog('graph.retrieval', 'calling MCP tool', {
    tool: 'rag.answer',
    topK: 5,
    fallbackToChat: false,
    retrievalQuery: state.retrievalQuery
  });
  const response = await mcpClient.ragAnswer({
    query: state.userInput,
    retrievalQuery: state.retrievalQuery || state.userInput,
    topK: 5,
    fallbackToChat: false
  });
  devLog('graph.retrieval', 'MCP tool response received', {
    success: response.success,
    confidence: response.confidence,
    hasResult: Boolean(response.result),
    errorCount: response.errors?.length ?? 0
  });
  return {
    ...state,
    answer: response.result?.answer ?? 'No answer available.',
    citations: response.citations ?? [],
    chunks: response.result?.chunks ?? [],
    errors: response.errors ?? []
  };
};

const chatNode = async (state: typeof GraphAnnotation.State) => {
  devLog('graph.chat', 'calling MCP tool', { tool: 'chat.answer' });
  const response = await mcpClient.chatAnswer({ message: state.userInput });
  devLog('graph.chat', 'MCP tool response received', {
    success: response.success,
    confidence: response.confidence,
    hasResult: Boolean(response.result),
    errorCount: response.errors?.length ?? 0
  });
  return {
    ...state,
    answer: response.result?.answer ?? 'No answer available.',
    errors: response.errors ?? []
  };
};

const configNode = async (state: typeof GraphAnnotation.State) => {
  devLog('graph.config', 'calling MCP tool', { tool: 'config.generate', useRagContext: true, topK: 3 });
  const response = await mcpClient.configGenerate({ instruction: state.userInput, useRagContext: true, topK: 3 });
  devLog('graph.config', 'MCP tool response received', {
    success: response.success,
    confidence: response.confidence,
    hasResult: Boolean(response.result),
    errorCount: response.errors?.length ?? 0
  });
  return {
    ...state,
    generatedConfig: response.result?.generatedConfig ?? '',
    chunks: response.result?.chunks ?? [],
    citations: response.citations ?? [],
    errors: response.errors ?? []
  };
};

const graph = new StateGraph(GraphAnnotation)
  .addNode('detectIntent', detectIntentNode)
  .addNode('retrieval', retrievalNode)
  .addNode('chat', chatNode)
  .addNode('config', configNode)
  .addEdge(START, 'detectIntent')
  .addConditionalEdges('detectIntent', (state) => state.intent, {
    retrieval: 'retrieval',
    chat: 'chat',
    config: 'config'
  })
  .addEdge('retrieval', END)
  .addEdge('chat', END)
  .addEdge('config', END)
  .compile();

export async function runMainGraph(userInput: string) {
  const startedAt = Date.now();
  devLog('graph', 'invoke start', { inputLength: userInput.length, inputPreview: userInput.slice(0, 180) });
  try {
    const result = await graph.invoke({
      userInput,
      intent: 'chat',
      answer: '',
      generatedConfig: '',
      retrievalQuery: userInput,
      routeReason: '',
      routeConfidence: 0,
      retrievalProbeConfidence: 0,
      citations: [],
      chunks: [],
      errors: []
    });
    devLog('graph', 'invoke complete', {
      intent: result.intent,
      latencyMs: Date.now() - startedAt,
      errorCount: result.errors?.length ?? 0
    });
    return result;
  } catch (error) {
    devError('graph', 'invoke failed', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
