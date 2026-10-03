import { useEffect, useMemo } from 'react';
import type { Meeting, MeetingMeta } from '../types.ts';
import { fmt } from '../util.ts';
import { Highlight } from './bits.tsx';

interface Props {
  q: string;
  meetings: MeetingMeta[];
  full: Record<string, Meeting>;
  loadFull: (id: string) => Promise<Meeting>;
  onOpen: (id: string, focus?: { t: number }) => void;
  onClear: () => void;
}

interface Hit { id: string; t: number; kind: string; text: string; jump: boolean }

export default function SearchView({ q, meetings, full, loadFull, onOpen, onClear }: Props) {
  const missing = meetings.filter(m => !full[m.id]).map(m => m.id);
  useEffect(() => { missing.forEach(id => loadFull(id).catch(() => {})); }, [missing.join(','), loadFull]); // eslint-disable-line react-hooks/exhaustive-deps

  const hits = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const match = (s: string) => { const l = s.toLowerCase(); return terms.every(t => l.includes(t)); };
    const out: Hit[] = [];
    for (const m of meetings) {
      if (match(m.title)) out.push({ id: m.id, t: 0, kind: 'Meeting', text: m.title, jump: false });
      const s = m.summary;
      if (s) {
        if (match(s.overview)) out.push({ id: m.id, t: 0, kind: 'Overview', text: s.overview, jump: false });
        s.chapters.forEach(c => match(`${c.title} ${c.summary}`) && out.push({ id: m.id, t: c.start, kind: 'Chapter', text: `${c.title}: ${c.summary}`, jump: true }));
        s.actions.forEach(a => match(`${a.text} ${a.owner}`) && out.push({ id: m.id, t: a.t, kind: 'Action item', text: `${a.owner}: ${a.text}`, jump: true }));
        s.decisions.forEach(d => match(d) && out.push({ id: m.id, t: 0, kind: 'Decision', text: d, jump: false }));
      }
      full[m.id]?.lines.forEach(l => match(`${l.x} ${l.s}`) && out.push({ id: m.id, t: l.t, kind: l.s, text: l.x, jump: true }));
    }
    return out;
  }, [q, meetings, full]);

  const titles = new Map(meetings.map(m => [m.id, m.title]));

  return (
    <>
      <button className="btn ghost back" onClick={onClear}>← My Calls</button>
      <div className="mhead">
        <span className="eyebrow">Search across {meetings.length} call{meetings.length === 1 ? "" : "s"}</span>
        <h2>“{q}”</h2>
        <div className="meta">{hits.length} result{hits.length === 1 ? '' : 's'}{missing.length ? ' · searching transcripts…' : ''}</div>
      </div>
      <div className="sec">
        {hits.slice(0, 200).map((h, i) => (
          <button key={i} className="hit" onClick={() => onOpen(h.id, h.jump ? { t: h.t } : undefined)}>
            <span className="src"><b>{titles.get(h.id)}</b><span className="mono">{fmt(h.t)}</span><span>{h.kind}</span></span>
            <span><Highlight text={h.text.length > 320 ? h.text.slice(0, 320) + '…' : h.text} q={q} /></span>
          </button>
        ))}
        {!hits.length && !missing.length && <p className="parse-info">Nothing matched. Try fewer words.</p>}
      </div>
    </>
  );
}
