import type { ChatTurn, Meeting, Summary } from '../src/types.ts';
import * as claude from './claude.ts';
import { askWithGroq, describeGroqError, GROQ_MODEL, summarizeWithGroq } from './groq.ts';

export type Provider = 'anthropic' | 'groq' | null;

/** AI_PROVIDER picks explicitly; otherwise whichever key is set (Anthropic first). Read at call time so .env changes apply after restart. */
export function provider(): Provider {
  const pick = process.env.AI_PROVIDER?.toLowerCase();
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  if (pick === 'groq' && hasGroq) return 'groq';
  if (pick === 'anthropic' && hasAnthropic) return 'anthropic';
  return hasAnthropic ? 'anthropic' : hasGroq ? 'groq' : null;
}

export const providerLabel = () =>
  provider() === 'anthropic' ? 'Claude Opus 5.5' : provider() === 'groq' ? `Groq · ${GROQ_MODEL}` : '';

export const aiEnabled = () => provider() !== null;

export function summarize(m: Meeting, onStatus: (s: string) => void): Promise<Summary> {
  return provider() === 'groq' ? summarizeWithGroq(m, onStatus) : claude.summarize(m);
}

export function ask(scope: { meeting: Meeting } | { library: Meeting[] }, turns: ChatTurn[], onText: (d: string) => void, signal: AbortSignal) {
  return provider() === 'groq' ? askWithGroq(scope, turns, onText, signal) : claude.ask(scope, turns, onText, signal);
}

export const describeError = (err: unknown) => (provider() === 'groq' ? describeGroqError(err) : claude.describeClaudeError(err));

export const NO_KEY = 'Add GROQ_API_KEY (free) or ANTHROPIC_API_KEY to web/.env and restart the server.';
