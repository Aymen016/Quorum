import Groq from 'groq-sdk';
import type { ChatTurn, Meeting, Summary } from '../src/types.ts';
import { fmt, fmtDur, transcriptText } from '../src/util.ts';
import { normalizeSummary, SUMMARY_SHAPE } from './summary.ts';

// Groq's free tier allows ~8K tokens per minute per model, so every request here is sized
// to stay under that (input + output), and the SDK waits out 429s using retry-after.
export const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const CHUNK_CHARS = 11_000;     // ~2.8K tokens of transcript per summarizing request
const NOTES_LIMIT = 11_000;     // merge notes further until they fit one request
const ASK_CONTEXT_CHARS = 14_000;

let client: Groq | null = null;
const groq = () => (client ??= new Groq({ maxRetries: 8, timeout: 120_000 }));

export class GroqError extends Error {}

export function describeGroqError(err: unknown): string {
  if (err instanceof GroqError) return err.message;
  if (err instanceof Groq.AuthenticationError) return 'The Groq API key was rejected. Check GROQ_API_KEY in web/.env.';
  if (err instanceof Groq.RateLimitError) return 'Groq free-tier limit reached. Wait a minute (or until tomorrow for the daily cap) and try again.';
  if (err instanceof Groq.APIError) return `Groq error ${err.status ?? ''}: ${err.message}`;
  return 'Could not reach Groq. Check your connection and try again.';
}

async function complete(prompt: string, maxTokens: number, json = false) {
  const res = await groq().chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: maxTokens,
    reasoning_effort: 'low',
    include_reasoning: false,
    ...(json ? { response_format: { type: 'json_object' as const } } : {}),
  });
  const text = res.choices[0]?.message?.content ?? '';
  if (!text.trim()) throw new GroqError('Groq returned an empty response. Try again.');
  return text;
}

function chunkLines(m: Meeting) {
  const parts: Meeting['lines'][] = [];
  let cur: Meeting['lines'] = [], size = 0;
  for (const l of m.lines) {
    const n = l.x.length + l.s.length + 12;
    if (size + n > CHUNK_CHARS && cur.length) { parts.push(cur); cur = []; size = 0; }
    cur.push(l); size += n;
  }
  if (cur.length) parts.push(cur);
  return parts;
}

export async function summarizeWithGroq(m: Meeting, onStatus: (s: string) => void): Promise<Summary> {
  const head = `Call: "${m.title}" (${fmtDur(m.duration)}, ${m.duration} seconds). Speakers: ${m.speakers.join(', ')}.`;
  const parts = chunkLines(m);
  let notes: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    onStatus(parts.length > 1 ? `Reading part ${i + 1} of ${parts.length}` : 'Reading the transcript');
    const p = parts[i];
    notes.push(`--- Part ${i + 1} (${fmt(p[0].t)}–${fmt(p[p.length - 1].t)}) ---\n` + await complete(
      `${head}\nThis is part ${i + 1} of ${parts.length} of the transcript. Write terse working notes (max 250 words): topics with their start time in seconds, decisions, action items (owner, task, due date if said, seconds), and one line per speaker on what they said or committed to. Use names exactly as written. No preamble.\n\n${transcriptText(p)}`,
      1500,
    ));
  }
  // Long calls: condense neighbouring notes until they fit a single request.
  while (notes.join('\n\n').length > NOTES_LIMIT && notes.length > 1) {
    onStatus('Condensing notes');
    const merged: string[] = [];
    for (let i = 0; i < notes.length; i += 2) {
      merged.push(i + 1 < notes.length
        ? await complete(`Merge these consecutive meeting notes into one set of terse notes (max 300 words), keeping every decision, action item, timestamp and speaker commitment.\n\n${notes[i]}\n\n${notes[i + 1]}`, 1500)
        : notes[i]);
    }
    notes = merged;
  }
  onStatus('Writing the summary');
  const source = parts.length === 1 ? `Transcript:\n${transcriptText(m.lines)}` : `Notes from each part of the call:\n\n${notes.join('\n\n')}`;
  const text = await complete(
    `You write meeting minutes. ${head}\nReturn ONLY a JSON object with exactly this shape:\n${SUMMARY_SHAPE}\nChapters cover the whole call in order; "start" and "t" are seconds. Include every speaker in "people". Never invent decisions or tasks.\n\n${source}`,
    3500,
    true,
  );
  try {
    return normalizeSummary(JSON.parse(text), m.duration);
  } catch {
    throw new GroqError('Groq returned a summary that could not be read. Try again.');
  }
}

/* ---------- Ask: answer from the most relevant slices, to fit the free-tier budget ---------- */
const STOP = new Set('about after again also because been before being could does doing from have here into just like made make more most much only other over said same should some such than that their them then there these they this those very want were what when where which while will with would your call calls meeting meetings'.split(' '));
const terms = (s: string) => [...new Set(s.toLowerCase().match(/[a-z0-9']{4,}/g) ?? [])].filter(w => !STOP.has(w));

function relevantLines(meetings: Meeting[], question: string, budget: number, label: boolean) {
  const ts = terms(question);
  const scored: { m: Meeting; i: number; score: number }[] = [];
  for (const m of meetings) m.lines.forEach((l, i) => {
    const low = `${l.s} ${l.x}`.toLowerCase();
    const score = ts.reduce((n, t) => n + (low.includes(t) ? 1 : 0), 0);
    if (score) scored.push({ m, i, score });
  });
  scored.sort((a, b) => b.score - a.score);
  const picked = new Map<Meeting, Set<number>>();
  let used = 0;
  for (const s of scored) {
    const set = picked.get(s.m) ?? new Set<number>();
    for (const i of [s.i - 1, s.i, s.i + 1]) {
      const l = s.m.lines[i];
      if (!l || set.has(i)) continue;
      used += l.x.length + 30;
      if (used > budget) break;
      set.add(i);
    }
    picked.set(s.m, set);
    if (used > budget) break;
  }
  return [...picked].map(([m, set]) => {
    const lines = [...set].sort((a, b) => a - b).map(i => m.lines[i]);
    return (label ? `From "${m.title}" (${new Date(m.date).toDateString()}):\n` : '') + transcriptText(lines);
  }).join('\n\n');
}

function compactMinutes(m: Meeting) {
  const s = m.summary;
  if (!s) return `"${m.title}" (${new Date(m.date).toDateString()}): no summary yet.`;
  return `"${m.title}" (${new Date(m.date).toDateString()}, ${fmtDur(m.duration)}; ${m.speakers.join(', ')})\nSummary: ${s.overview}\nDecisions: ${s.decisions.join(' | ')}\nAction items: ${s.actions.map(a => `${a.owner}: ${a.text}${a.done ? ' (done)' : ''} [${fmt(a.t)}]`).join(' | ')}`;
}

export async function askWithGroq(
  scope: { meeting: Meeting } | { library: Meeting[] },
  turns: ChatTurn[],
  onText: (delta: string) => void,
  signal: AbortSignal,
) {
  const recent = turns.slice(-6).map(t => ({ ...t, content: t.role === 'assistant' ? t.content.slice(0, 1500) : t.content }));
  const question = recent.filter(t => t.role === 'user').map(t => t.content).join(' ');
  let context: string;
  if ('meeting' in scope) {
    const m = scope.meeting;
    const full = transcriptText(m.lines);
    const minutes = compactMinutes(m);
    const tx = minutes.length + full.length <= ASK_CONTEXT_CHARS
      ? `Transcript:\n${full}`
      : `Most relevant transcript excerpts:\n${relevantLines([m], question, ASK_CONTEXT_CHARS - minutes.length, false) || '(no lines matched the question; rely on the summary)'}`;
    context = `You answer questions about one call. Cite moments as [m:ss] timestamps.\n\n${minutes}\n\n${tx}`;
  } else {
    const sorted = [...scope.library].sort((a, b) => b.date - a.date);
    let digest = '';
    for (const m of sorted) {
      const block = compactMinutes(m);
      if (digest.length + block.length > ASK_CONTEXT_CHARS * 0.65) break;
      digest += block + '\n\n';
    }
    const excerpts = relevantLines(sorted, question, ASK_CONTEXT_CHARS - digest.length, true);
    context = `You answer questions across a person's recorded calls. Name the call (title and date) for anything you use.\n\nCall summaries (newest first):\n${digest}${excerpts ? `Relevant transcript excerpts:\n${excerpts}` : ''}`;
  }
  const stream = await groq().chat.completions.create({
    model: GROQ_MODEL,
    stream: true,
    max_completion_tokens: 1800,
    reasoning_effort: 'low',
    include_reasoning: false,
    messages: [
      { role: 'system', content: `${context}\n\nToday is ${new Date().toDateString()}. Be concise and concrete. If the material does not say, say so. Plain text with short paragraphs or "-" bullets; no markdown headings or bold.` },
      ...recent.map(t => ({ role: t.role, content: t.content })),
    ],
  }, { signal });
  for await (const chunk of stream) {
    const d = chunk.choices[0]?.delta?.content;
    if (d) onText(d);
  }
}
