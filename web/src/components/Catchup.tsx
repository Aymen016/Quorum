import { useMemo, useState } from 'react';
import type { Meeting } from '../types.ts';
import { escapeRe, initials, talkShare } from '../util.ts';
import { Highlight, TimeButton, speakerColor } from './bits.tsx';

interface Props { meeting: Meeting; onJump: (t: number) => void; status: React.ReactNode }

export default function Catchup({ meeting: m, onJump, status }: Props) {
  const [picked, setPicked] = useState(m.speakers[0]);
  const p = m.speakers.includes(picked) ? picked : m.speakers[0];
  const share = useMemo(() => talkShare(m.lines), [m.lines]);
  const first = p.split(/\s+/)[0];
  const info = m.summary?.people.find(x => x.name.toLowerCase() === p.toLowerCase());
  const turns = m.lines.filter(l => l.s === p).length;
  const mentions = useMemo(() => {
    if (first.length < 3) return [];
    const re = new RegExp(`\\b${escapeRe(first)}\\b`, 'i');
    return m.lines.filter(l => l.s !== p && re.test(l.x));
  }, [m.lines, p, first]);
  const actions = (m.summary?.actions ?? []).filter(a => a.owner.toLowerCase() === p.toLowerCase());

  return (
    <div className="sec">
      <p className="parse-info" style={{ margin: 0 }}>Pick a person to see what they said, what they signed up for, and every time someone mentioned them.</p>
      <div className="people">
        {m.speakers.map(s => (
          <button key={s} className={`chip${s === p ? ' on' : ''}`} onClick={() => setPicked(s)}>
            <span className="avatar" style={{ background: speakerColor(m.speakers, s) }}>{initials(s)}</span>{s}
          </button>
        ))}
      </div>
      <div className="cols" style={{ marginTop: 8 }}>
        <div className="pcard">
          <div className="stats">
            <div className="stat"><b className="mono">{Math.round((share[p] || 0) * 100)}%</b><span>of talk time</span></div>
            <div className="stat"><b className="mono">{turns}</b><span>turns</span></div>
            <div className="stat"><b className="mono">{actions.length}</b><span>action items</span></div>
            <div className="stat"><b className="mono">{mentions.length}</b><span>mentions by others</span></div>
          </div>
          {info ? <p className="overview" style={{ fontSize: 15 }}>{info.summary}</p> : status}
          {info && info.commitments.length > 0 && (
            <div className="sec"><h3>Committed to</h3><ul>{info.commitments.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
          )}
          {info && info.asks.length > 0 && (
            <div className="sec"><h3>Waiting on {first}</h3><ul>{info.asks.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
          )}
        </div>
        <div className="sec">
          <h3>Mentions of {first}</h3>
          <div>
            {mentions.length ? mentions.slice(0, 30).map((l, i) => (
              <div key={i} className="moment">
                <TimeButton t={l.t} onJump={onJump} />
                <div><b style={{ fontWeight: 600 }}>{l.s}</b> <Highlight text={l.x} q={first} /></div>
              </div>
            )) : <p className="parse-info">Nobody mentioned them by name.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
