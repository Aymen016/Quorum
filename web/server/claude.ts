import Anthropic from '@anthropic-ai/sdk';
import type { ChatTurn, Meeting, Summary } from '../src/types.ts';
import { fmtDur, transcriptText } from '../src/util.ts';
import { normalizeSummary } from './summary.ts';

const MODEL = 'claude-opus-5-5';
// Server-side refusal fallback: if a safety classifier declines, the API re-runs the
// request on Anthropic's recommended fallback model inside the same call.
const BETAS = ['server-side-fallback-2026-07-01'];

export const claudeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const str = { type: 'string' } as const;
const num = { type: 'number' } as const;
const strList = { type: 'array', items: str } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
});

const SUMMARY_SCHEMA = obj({
  overview: str,
  chapters: { type: 'array', items: obj({ start: num, title: str, summary: str }) },
  decisions: strList,
  actions: { type: 'array', items: obj({ owner: str, text: str, due: str, t: num }) },
  people: { type: 'array', items: obj({ name: str, summary: str, commitments: strList, asks: strList }) },
  topics: strList,
});

export class ClaudeError extends Error {}

function describe(err: unknown): string {
  if (err instanceof ClaudeError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in web/.env.';
  if (err instanceof Anthropic.RateLimitError) return 'Claude is rate limited right now. Try again in a minute.';
  if (err instanceof Anthropic.BadRequestError) return `Claude rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status ?? ''}: ${err.message}`;
  return 'Could not reach Claude. Check your connection and try again.';
}
export { describe as describeClaudeError };

function header(m: Meeting) {
  return `Meeting: "${m.title}" (${fmtDur(m.duration)}, duration ${m.duration} seconds, ${m.speakers.length} speakers: ${m.speakers.join(', ')}).`;
}

export async function summarize(m: Meeting): Promise<Summary> {
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    betas: BETAS,
    fallbacks: 'default',
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SUMMARY_SCHEMA } },
    system:
      'You write meeting minutes for long multi-speaker meetings. Be faithful to the transcript: never invent decisions, owners or tasks. Use speaker names exactly as written.',
    messages: [{
      role: 'user',
      content: `${header(m)}

Write the minutes as JSON.
- overview: 3-5 plain sentences covering the purpose, what was settled and what is still open.
- chapters: cover the whole meeting in order, roughly one per 4-10 minutes. "start" is in seconds and matches a transcript timestamp.
- decisions: only things the group actually agreed.
- actions: imperative tasks with the owner's exact name (or "Unassigned"), the due date if one was said (else ""), and "t" = seconds where it was agreed.
- people: one entry per speaker: 2-3 sentences on their contribution and position, what they committed to, and anything waiting on them.
- topics: 3-8 short tags.

Transcript:
${transcriptText(m.lines)}`,
    }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new ClaudeError('Claude declined to summarize this transcript.');
  if (msg.stop_reason === 'max_tokens') throw new ClaudeError('The minutes were cut off. Try again.');
  const text = msg.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('');
  try {
    return normalizeSummary(JSON.parse(text), m.duration);
  } catch {
    throw new ClaudeError('Claude returned minutes that could not be read. Try again.');
  }
}

function minutesJson(m: Meeting) {
  return m.summary
    ? `Minutes (JSON): ${JSON.stringify({ overview: m.summary.overview, decisions: m.summary.decisions, actions: m.summary.actions })}\n`
    : 'No minutes yet.\n';
}

// Roughly 500k tokens of transcript; older calls beyond that are represented by their minutes only.
const LIBRARY_CHAR_BUDGET = 2_000_000;

function libraryContext(meetings: Meeting[]) {
  let used = 0;
  return [...meetings].sort((a, b) => b.date - a.date).map(m => {
    const tx = transcriptText(m.lines);
    const includeTx = used + tx.length <= LIBRARY_CHAR_BUDGET;
    if (includeTx) used += tx.length;
    return `=== Call: "${m.title}" · ${new Date(m.date).toDateString()} · ${fmtDur(m.duration)} · ${m.speakers.join(', ')} ===\n${minutesJson(m)}${includeTx ? `Transcript:\n${tx}` : '(Transcript omitted for length; use the minutes.)'}`;
  }).join('\n\n');
}

/** Streams an answer about one call, or about every call when `meeting` is null. */
export async function ask(
  scope: { meeting: Meeting } | { library: Meeting[] },
  turns: ChatTurn[],
  onText: (delta: string) => void,
  signal: AbortSignal,
) {
  const today = `Today is ${new Date().toDateString()}.`;
  const context = 'meeting' in scope
    ? `You answer a teammate's questions about one call. Cite moments as [m:ss] or [h:mm:ss] timestamps from the transcript.

${header(scope.meeting)} Date: ${new Date(scope.meeting.date).toDateString()}.
${minutesJson(scope.meeting)}Transcript:
${transcriptText(scope.meeting.lines)}`
    : `You answer a teammate's questions across all of their recorded calls. Name the call (title and date) whenever you use something from it. Group answers by call or by project when that helps.

${libraryContext(scope.library)}`;
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: BETAS,
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system: [
      {
        type: 'text',
        // Stable per call/library, so follow-up questions read the transcripts from the prompt cache.
        text: `${context}\n\nBe concise and concrete. If the calls do not say, say so. Plain text with short paragraphs or "-" bullets; no markdown headings or bold.`,
        cache_control: { type: 'ephemeral' },
      },
      { type: 'text', text: today },
    ],
    messages: turns.map(t => ({ role: t.role, content: t.content })),
  }, { signal });
  stream.on('text', delta => onText(delta));
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new ClaudeError('Claude declined to answer that.');
}
