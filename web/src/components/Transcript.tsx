import { useEffect, useRef, useState } from 'react';
import type { Clip, Meeting } from '../types.ts';
import type { Focus } from '../App.tsx';
import { api } from '../api.ts';
import { fmt, lineEnd } from '../util.ts';
import { Highlight, SearchIcon, speakerColor } from './bits.tsx';

interface Props { meeting: Meeting; jump: Focus | null; now?: number | null; onClipSaved: (c: Clip) => void; say: (msg: string) => void }

export default function Transcript({ meeting: m, jump, now = null, onClipSaved, say }: Props) {
  const [q, setQ] = useState('');
  const [clipMode, setClipMode] = useState(false);
  const [sel, setSel] = useState<[number, number | null] | null>(null);
  const [clipTitle, setClipTitle] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const lines = m.lines;
  const [follow, setFollow] = useState(true);

  // The line being spoken at the current playback time.
  let playing = -1;
  if (now != null) for (let i = 0; i < lines.length && lines[i].t <= now + 0.25; i++) playing = i;
  useEffect(() => {
    if (!follow || playing < 0 || !listRef.current) return;
    listRef.current.querySelector<HTMLElement>('[data-i="' + playing + '"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [playing, follow]);

  // A clip opened from the rail highlights its range.
  useEffect(() => {
    if (!jump) return;
    setQ('');
    if (jump.range) {
      const a = lines.findIndex(l => l.t >= jump.range![0]);
      let b = a;
      lines.forEach((l, i) => { if (l.t < jump.range![1]) b = Math.max(b, i); });
      setSel(a >= 0 ? [a, b] : null);
    } else setSel(null);
  }, [jump, lines]);

  // Scroll to and flash the turn nearest the jump time.
  useEffect(() => {
    if (!jump || !listRef.current) return;
    const els = [...listRef.current.querySelectorAll<HTMLElement>('.turn')];
    let best = els[0];
    for (const el of els) { if (Number(el.dataset.t) <= jump.t) best = el; else break; }
    if (!best) return;
    best.scrollIntoView({ block: 'center' });
    best.classList.remove('flash');
    void best.offsetWidth;
    best.classList.add('flash');
  }, [jump]);

  const needle = q.trim().toLowerCase();
  const shown = lines.map((l, i) => ({ l, i })).filter(({ l }) => !needle || `${l.x} ${l.s}`.toLowerCase().includes(needle));
  const lo = sel ? Math.min(sel[0], sel[1] ?? sel[0]) : -1;
  const hi = sel ? Math.max(sel[0], sel[1] ?? sel[0]) : -1;
  const ready = clipMode && sel && sel[1] != null;

  const pick = (i: number) => {
    if (!clipMode) return;
    if (!sel || sel[1] != null) { setSel([i, null]); return; }
    setSel([sel[0], i]);
    const a = Math.min(sel[0], i);
    setClipTitle(lines[a].x.split(/\s+/).slice(0, 7).join(' '));
  };

  const save = async () => {
    try {
      const c = await api.createClip({ meetingId: m.id, start: lines[lo].t, end: lineEnd(lines[hi]), title: clipTitle.trim() || 'Untitled clip' });
      onClipSaved(c);
      const text = `${c.title}\n${m.title} · ${fmt(c.start)}–${fmt(c.end)}\n\n` +
        lines.slice(lo, hi + 1).map(l => `[${fmt(l.t)}] ${l.s}: ${l.x}`).join('\n') +
        `\n\n${location.origin}/#c-${c.id}`;
      await navigator.clipboard.writeText(text).then(() => say('Clip saved, quote and link copied'), () => say('Clip saved'));
      setClipMode(false);
      setSel([lo, hi]);
    } catch (e) { say((e as Error).message); }
  };

  return (
    <>
      <div className="tr-tools">
        <div className="search">
          <SearchIcon />
          <input id="trq" type="search" placeholder="Search this transcript" autoComplete="off" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className={`btn${clipMode ? ' primary' : ''}`} onClick={() => { setClipMode(!clipMode); setSel(null); }}>
          {clipMode ? 'Cancel clip' : 'Make a clip'}
        </button>
        {now != null && <label className="parse-info" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={follow} onChange={e => setFollow(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />Follow playback</label>}
        {needle && <span className="parse-info">{shown.length} match{shown.length === 1 ? '' : 'es'}</span>}
      </div>
      {clipMode && (
        <p className="parse-info" style={{ margin: 0 }}>
          {!sel ? 'Click the first line of the clip.' : sel[1] == null ? 'Now click the last line.' : 'Name the clip and save it.'}
        </p>
      )}
      <div ref={listRef}>
        {shown.map(({ l, i }) => (
          <div key={i} data-t={l.t} data-i={i} className={`turn${i >= lo && i <= hi ? ' sel' : ''}${i === playing ? ' playing' : ''}${clipMode ? ' clipping' : ''}`} onClick={() => pick(i)}>
            <span className="tbtn" style={{ cursor: 'inherit' }}>{fmt(l.t)}</span>
            <div>
              <div className="who"><span className="dot" style={{ background: speakerColor(m.speakers, l.s) }} />{l.s}</div>
              <p><Highlight text={l.x} q={q} /></p>
            </div>
          </div>
        ))}
      </div>
      {ready && (
        <div className="clipbar">
          <span className="mono">{fmt(lines[lo].t)}–{fmt(lineEnd(lines[hi]))}</span>
          <input id="clipTitle" type="text" placeholder="Clip title" value={clipTitle} onChange={e => setClipTitle(e.target.value)} />
          <button className="btn primary" onClick={save}>Save clip</button>
        </div>
      )}
    </>
  );
}
