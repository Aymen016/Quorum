import type { Meeting } from '../types.ts';
import { TimeButton, speakerColor } from './bits.tsx';

interface Props { meeting: Meeting; onJump: (t: number) => void; onToggle: (i: number, done: boolean) => void }

export default function Minutes({ meeting: m, onJump, onToggle }: Props) {
  const s = m.summary!;
  const done = s.actions.filter(a => a.done).length;
  return (
    <div className="cols">
      <div className="sec">
        <span className="eyebrow">Overview</span>
        <p className="overview">{s.overview}</p>
        {s.topics.length > 0 && <div className="topics">{s.topics.map(t => <span key={t} className="pill">{t}</span>)}</div>}
        <h3 style={{ marginTop: 14 }}>Chapters</h3>
        <div>
          {s.chapters.length ? s.chapters.map((c, i) => (
            <div key={i} className="chapter">
              <TimeButton t={c.start} onJump={onJump} />
              <div><h4>{c.title}</h4><p>{c.summary}</p></div>
            </div>
          )) : <p className="parse-info">No chapters.</p>}
        </div>
      </div>
      <div className="sec">
        <div className="card">
          <div className="row">
            <h3 className="grow">Action items</h3>
            <span className="parse-info mono">{done}/{s.actions.length} done</span>
          </div>
          {s.actions.length ? s.actions.map((a, i) => {
            const id = `act-${m.id}-${i}`;
            return (
              <div key={i} className={`action${a.done ? ' done' : ''}`}>
                <input type="checkbox" id={id} checked={a.done} onChange={e => onToggle(i, e.target.checked)} />
                <div>
                  <label htmlFor={id} className="txt">{a.text}</label>
                  <div className="who">
                    <span className="dot" style={{ background: speakerColor(m.speakers, a.owner) }} />
                    {a.owner}{a.due ? ` · due ${a.due}` : ''}
                    <TimeButton t={a.t} onJump={onJump} />
                  </div>
                </div>
              </div>
            );
          }) : <p className="parse-info">No action items were agreed.</p>}
        </div>
        <div className="card">
          <h3>Decisions</h3>
          {s.decisions.length ? s.decisions.map((d, i) => (
            <div key={i} className="decision"><span className="n">{String(i + 1).padStart(2, '0')}</span><span>{d}</span></div>
          )) : <p className="parse-info">No decisions recorded.</p>}
        </div>
      </div>
    </div>
  );
}
