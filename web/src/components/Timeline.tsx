import { useMemo } from 'react';
import type { Meeting } from '../types.ts';
import { fmt, segments, talkShare } from '../util.ts';
import { speakerColor } from './bits.tsx';

export default function Timeline({ meeting: m, onJump }: { meeting: Meeting; onJump: (t: number) => void }) {
  const D = Math.max(1, m.duration);
  const segs = useMemo(() => segments(m.lines), [m.lines]);
  const share = useMemo(() => talkShare(m.lines), [m.lines]);
  const step = D > 5400 ? 1800 : D > 2400 ? 600 : D > 900 ? 300 : 60;
  const ticks: number[] = [];
  for (let t = 0; t <= D; t += step) ticks.push(t);
  const pct = (t: number) => `${((t / D) * 100).toFixed(3)}%`;
  const chapters = m.summary?.chapters ?? [];

  return (
    <section className="tl" aria-label="Speaker timeline">
      <div className="tl-top">
        <span className="eyebrow">Who spoke when</span>
        <span className="parse-info">Click a bar to jump to that moment</span>
      </div>
      {chapters.length > 0 && (
        <div className="tl-grid">
          <span className="eyebrow">Chapters</span>
          <div className="chaps">
            {chapters.map((c, i) => {
              const next = chapters[i + 1]?.start ?? D;
              return (
                <button key={i} className="chap-tick" style={{ left: pct(c.start), width: pct(Math.max(D / 100, next - c.start)) }}
                  title={`${fmt(c.start)} ${c.title}`} onClick={() => onJump(c.start)}>{c.title}</button>
              );
            })}
          </div>
          <span />
        </div>
      )}
      <div className="tl-grid">
        {m.speakers.map(s => (
          <Row key={s} name={s} color={speakerColor(m.speakers, s)} share={share[s] || 0}>
            {segs.filter(g => g.s === s).map((g, i) => (
              <button key={i} className="seg" aria-label={`${s} at ${fmt(g.t)}`} onClick={() => onJump(g.t)}
                style={{ left: pct(g.t), width: `max(2px, ${pct(g.end - g.t)})`, background: speakerColor(m.speakers, s) }} />
            ))}
          </Row>
        ))}
        <span />
        <div className="axis">{ticks.map(t => <span key={t} className="mono" style={{ left: pct(t) }}>{fmt(t)}</span>)}</div>
        <span />
      </div>
    </section>
  );
}

function Row({ name, color, share, children }: { name: string; color: string; share: number; children: React.ReactNode }) {
  return (
    <>
      <span className="tl-name" title={name}><span className="dot" style={{ background: color }} />{name}</span>
      <div className="track">{children}</div>
      <span className="pct mono">{Math.round(share * 100)}%</span>
    </>
  );
}
