import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { completeChat } from '../utils/llm';
import { batchConfigAgent } from '../agents/batchConfigAgent';
import { retrievalAgent } from '../agents/retrievalAgent';
import { routeIntent } from '../agents/supervisor';

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
  const result = await retrievalAgent(state.userInput);
  return { ...state, answer: result.answer, citations: result.citations, chunks: result.chunks };
};

const chatNode = async (state: typeof GraphAnnotation.State) => {
  const answer = await completeChat({ user: state.userInput });
  return { ...state, answer };
};

const configNode = async (state: typeof GraphAnnotation.State) => {
  const output = await batchConfigAgent(state.userInput);
  return { ...state, generatedConfig: output.generatedConfig, chunks: output.examples };
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
