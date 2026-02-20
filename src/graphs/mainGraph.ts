import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { routeIntent } from '../agents/supervisor';
import { mcpClient } from '../mcp/mcpClient';

const GraphAnnotation = Annotation.Root({
  userInput: Annotation<string>,
  intent: Annotation<'retrieval' | 'chat' | 'config'>,
  answer: Annotation<string>,
  generatedConfig: Annotation<string>,
  citations: Annotation<any[]>,
  chunks: Annotation<any[]>,
  errors: Annotation<string[]>
});

const detectIntentNode = async (state: typeof GraphAnnotation.State) => ({
  ...state,
  intent: routeIntent(state.userInput)
});

const retrievalNode = async (state: typeof GraphAnnotation.State) => {
  const response = await mcpClient.ragAnswer({ query: state.userInput, topK: 5, fallbackToChat: true });
  return {
    ...state,
    answer: response.result?.answer ?? 'No answer available.',
    citations: response.citations ?? [],
    chunks: response.result?.chunks ?? [],
    errors: response.errors ?? []
  };
};

const chatNode = async (state: typeof GraphAnnotation.State) => {
  const response = await mcpClient.chatAnswer({ message: state.userInput });
  return {
    ...state,
    answer: response.result?.answer ?? 'No answer available.',
    errors: response.errors ?? []
  };
};

const configNode = async (state: typeof GraphAnnotation.State) => {
  const response = await mcpClient.configGenerate({ instruction: state.userInput, useRagContext: true, topK: 3 });
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
  return graph.invoke({
    userInput,
    intent: 'chat',
    answer: '',
    generatedConfig: '',
    citations: [],
    chunks: [],
    errors: []
  });
}
