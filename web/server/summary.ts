import type { Summary } from '../src/types.ts';

/** Plain-text description of the minutes JSON, for providers without schema enforcement. */
export const SUMMARY_SHAPE = `{
  "overview": "3-5 plain sentences: purpose, what was settled, what is still open",
  "chapters": [{"start": <seconds>, "title": "short title", "summary": "1-2 sentences"}],
  "decisions": ["each decision actually agreed"],
  "actions": [{"owner": "exact speaker name or Unassigned", "text": "imperative task", "due": "due date if said, else empty string", "t": <seconds where agreed>}],
  "people": [{"name": "exact speaker name", "summary": "2-3 sentences on their contribution", "commitments": ["..."], "asks": ["open items waiting on them"]}],
  "topics": ["3-8 short tags"]
}`;

/** Coerces model output into a valid Summary, clamping timestamps into the call. */
export function normalizeSummary(raw: any, duration: number): Summary {
  const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
  const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
  const clamp = (v: unknown) => Math.max(0, Math.min(duration, Number(v) || 0));
  return {
    overview: str(raw?.overview),
    chapters: arr(raw?.chapters).map(c => ({ start: clamp(c.start), title: str(c.title), summary: str(c.summary) })).sort((a, b) => a.start - b.start),
    decisions: arr(raw?.decisions).map(str).filter(Boolean),
    actions: arr(raw?.actions).map(a => ({ owner: str(a.owner) || 'Unassigned', text: str(a.text), due: str(a.due), t: clamp(a.t), done: false })).filter(a => a.text),
    people: arr(raw?.people).map(p => ({ name: str(p.name), summary: str(p.summary), commitments: arr(p.commitments).map(str), asks: arr(p.asks).map(str) })),
    topics: arr(raw?.topics).map(str).filter(Boolean).slice(0, 8),
  };
}
