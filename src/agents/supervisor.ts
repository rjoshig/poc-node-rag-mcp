import { mcpClient } from '../mcp/mcpClient';
import { RetrievalChunk, RouterIntent } from '../types';
import { config } from '../utils/config';
import { devError, devLog } from '../utils/devLog';
import { completeChat } from '../utils/llm';

const retrievalTerms = [
  'policy',
  'compliance',
  'incident',
  'act',
  'section',
  'clause',
  'law',
  'legal',
  'rights',
  'obligation',
  'pass-holder',
  'pass holder',
  'revenue',
  'land',
  'allotment',
  'guideline',
  'procedure',
  'manual',
  'document'
];

const retrievalQuestionCues = [
  'what is',
  'what are',
  'which',
  'who',
  'where',
  'when',
  'how to',
  'can you explain',
  'give me information',
  'explain'
];

const configTerms = [
  'batch config',
  'generate config',
  'configuration',
  'json config',
  'attribute',
  'threshold',
  'mapping'
];

const configPatterns = [
  /\bif\b.+\bthen\b/,
  /\bif\b.+\breject\b/,
  /\bif\b.+\bapprove\b/,
  /\bscore\b.+[<>]=?\s*\d+/
];

const smallTalkPatterns = [
  /\bhello\b/,
  /\bhi\b/,
  /\bhey\b/,
  /\bhow are you\b/,
  /\bgood (morning|afternoon|evening)\b/,
  /\bthanks?\b/,
  /\bthank you\b/,
  /\bbye\b/
];

interface ClassifierResult {
  intent: RouterIntent;
  confidence: number;
  reason: string;
}

interface RetrievalProbe {
  confidence: number;
  topScore: number;
  avgTop3: number;
  scoreGap: number;
  chunkCount: number;
}

export interface RouteDecision {
  intent: RouterIntent;
  confidence: number;
  reason: string;
  retrievalQuery: string;
  retrievalProbe: RetrievalProbe;
  classifier?: ClassifierResult;
}

function includesTerm(input: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`\\b${escaped}\\b`).test(input);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function asNumber(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;

  const parse = (text: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };

  const direct = parse(candidate);
  if (direct) return direct;

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) return parse(candidate.slice(start, end + 1));
  return null;
}

function normalizeIntent(value: unknown): RouterIntent | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'chat' || normalized === 'retrieval' || normalized === 'config') return normalized;
  return null;
}

function isSmallTalk(lower: string): boolean {
  return smallTalkPatterns.some((pattern) => pattern.test(lower));
}

function computeRetrievalProbe(chunks: RetrievalChunk[]): RetrievalProbe {
  if (!chunks.length) {
    return { confidence: 0, topScore: 0, avgTop3: 0, scoreGap: 0, chunkCount: 0 };
  }

  const topScore = asNumber(chunks[0]?.score);
  const secondScore = asNumber(chunks[1]?.score);
  const top3 = chunks.slice(0, 3);
  const avgTop3 = top3.reduce((sum, chunk) => sum + asNumber(chunk.score), 0) / top3.length;
  const scoreGap = Math.max(0, topScore - secondScore);
  const blended = clamp01(topScore * 0.55 + avgTop3 * 0.35 + scoreGap * 0.1);

  return {
    confidence: Number(blended.toFixed(4)),
    topScore: Number(topScore.toFixed(4)),
    avgTop3: Number(avgTop3.toFixed(4)),
    scoreGap: Number(scoreGap.toFixed(4)),
    chunkCount: chunks.length
  };
}

async function classifyIntentWithLlm(input: string): Promise<ClassifierResult | undefined> {
  try {
    const raw = await completeChat({
      system:
        'Classify enterprise assistant request intent. Allowed intents: chat, retrieval, config. Retrieval means question should use private/internal documents or policies. Config means user asks to generate mapping/rule/config JSON. Output strict JSON only: {"intent":"chat|retrieval|config","confidence":0..1,"reason":"short"}',
      user: input
    });
    const parsed = extractJsonObject(raw);
    if (!parsed) return undefined;
    const intent = normalizeIntent(parsed.intent);
    if (!intent) return undefined;
    const confidence = clamp01(asNumber(parsed.confidence, 0.5));
    const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : 'llm_classifier';
    return { intent, confidence, reason };
  } catch (error) {
    devError('router.classifier', 'llm classification failed', error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

async function rewriteRetrievalQuery(input: string): Promise<string> {
  try {
    const raw = await completeChat({
      system:
        'Rewrite the user query for high-recall semantic retrieval over enterprise policy/legal docs. Keep entity names, law/act names, and keywords. Return strict JSON only: {"query":"..."}',
      user: input
    });
    const parsed = extractJsonObject(raw);
    const query = typeof parsed?.query === 'string' ? parsed.query.trim() : '';
    if (!query) return input;
    return query;
  } catch (error) {
    devError('router.rewrite', 'query rewrite failed', error instanceof Error ? error.message : String(error));
    return input;
  }
}

export function routeIntent(input: string): RouterIntent {
  const lower = input.toLowerCase().trim();
  if (!lower) return 'chat';
  if (isSmallTalk(lower)) return 'chat';

  const matchedConfigTerms = configTerms.filter((term) => includesTerm(lower, term));
  const matchedConfigPatterns = configPatterns.filter((pattern) => pattern.test(lower)).map((pattern) => pattern.toString());
  const configScore = matchedConfigTerms.length + (matchedConfigPatterns.length ? 2 : 0);
  if (configScore >= 1) {
    devLog('router.intent', 'classified request', {
      intent: 'config',
      inputPreview: input.slice(0, 180),
      inputLength: input.length,
      configScore,
      retrievalScore: 0,
      matchedConfigTerms,
      matchedConfigPatterns
    });
    return 'config';
  }

  const matchedRetrievalTerms = retrievalTerms.filter((term) => includesTerm(lower, term));
  const matchedQuestionCues = retrievalQuestionCues.filter((term) => includesTerm(lower, term));
  const hasRetrievalTerms = matchedRetrievalTerms.length > 0;
  const retrievalScore =
    matchedRetrievalTerms.length * 2 +
    (lower.includes('?') && hasRetrievalTerms ? 1 : 0) +
    (includesTerm(lower, 'information') ? 1 : 0) +
    (matchedQuestionCues.length ? 1 : 0);
  if (retrievalScore >= 2) {
    devLog('router.intent', 'classified request', {
      intent: 'retrieval',
      inputPreview: input.slice(0, 180),
      inputLength: input.length,
      configScore,
      retrievalScore,
      matchedRetrievalTerms,
      matchedQuestionCues
    });
    return 'retrieval';
  }

  devLog('router.intent', 'classified request', {
    intent: 'chat',
    inputPreview: input.slice(0, 180),
    inputLength: input.length,
    configScore,
    retrievalScore,
    matchedRetrievalTerms,
    matchedQuestionCues
  });

  return 'chat';
}

export async function routeRequest(input: string): Promise<RouteDecision> {
  const lower = input.toLowerCase().trim();
  if (!lower) {
    return {
      intent: 'chat',
      confidence: 1,
      reason: 'empty_input',
      retrievalQuery: input,
      retrievalProbe: { confidence: 0, topScore: 0, avgTop3: 0, scoreGap: 0, chunkCount: 0 }
    };
  }

  if (isSmallTalk(lower)) {
    const decision: RouteDecision = {
      intent: 'chat',
      confidence: 0.98,
      reason: 'small_talk_guard',
      retrievalQuery: input,
      retrievalProbe: { confidence: 0, topScore: 0, avgTop3: 0, scoreGap: 0, chunkCount: 0 }
    };
    devLog('router.intent', 'routing decision', decision);
    return decision;
  }

  const lexicalIntent = routeIntent(input);
  if (lexicalIntent === 'config') {
    const decision: RouteDecision = {
      intent: 'config',
      confidence: 0.95,
      reason: 'strong_config_pattern',
      retrievalQuery: input,
      retrievalProbe: { confidence: 0, topScore: 0, avgTop3: 0, scoreGap: 0, chunkCount: 0 }
    };
    devLog('router.intent', 'routing decision', decision);
    return decision;
  }

  const [classifier, rewrittenQuery] = await Promise.all([classifyIntentWithLlm(input), rewriteRetrievalQuery(input)]);
  devLog('router.intent', 'llm pre-routing signals', { classifier, rewrittenQuery });

  let retrievalProbe = { confidence: 0, topScore: 0, avgTop3: 0, scoreGap: 0, chunkCount: 0 };
  try {
    const retrievalResponse = await mcpClient.ragSearch({ query: rewrittenQuery, topK: 5 });
    const chunks = retrievalResponse.result?.chunks ?? [];
    retrievalProbe = computeRetrievalProbe(chunks);
  } catch (error) {
    devError('router.intent', 'retrieval probe failed', error instanceof Error ? error.message : String(error));
  }

  const classifierIntent = classifier?.intent;
  const classifierConfidence = classifier?.confidence ?? 0;
  const retrievalHigh = retrievalProbe.confidence >= config.routerRetrievalConfidenceHigh;
  const retrievalLow = retrievalProbe.confidence >= config.routerRetrievalConfidenceLow;
  const classifierHigh = classifierConfidence >= config.routerIntentConfidenceHigh;

  let intent: RouterIntent = 'chat';
  let confidence = Math.max(classifierConfidence, retrievalProbe.confidence);
  let reason = 'default_chat_fallback';

  if (classifierIntent === 'config' && classifierHigh) {
    intent = 'config';
    confidence = classifierConfidence;
    reason = 'classifier_config_high';
  } else if (retrievalHigh) {
    intent = 'retrieval';
    confidence = retrievalProbe.confidence;
    reason = 'retrieval_probe_high';
  } else if (classifierIntent === 'retrieval' && classifierHigh && retrievalLow) {
    intent = 'retrieval';
    confidence = Math.max(classifierConfidence, retrievalProbe.confidence);
    reason = 'classifier_retrieval_plus_probe';
  } else if (classifierIntent === 'chat' && classifierHigh && !retrievalHigh) {
    intent = 'chat';
    confidence = classifierConfidence;
    reason = 'classifier_chat_high';
  } else if (lexicalIntent === 'retrieval' && retrievalLow) {
    intent = 'retrieval';
    confidence = retrievalProbe.confidence;
    reason = 'lexical_retrieval_with_probe';
  }

  const decision: RouteDecision = {
    intent,
    confidence: Number(clamp01(confidence).toFixed(4)),
    reason,
    retrievalQuery: rewrittenQuery,
    retrievalProbe,
    classifier
  };
  devLog('router.intent', 'routing decision', decision);
  return decision;
}
