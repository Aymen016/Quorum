import { useState } from 'react';
import type { MeetingMeta } from '../types.ts';
import { initials } from '../util.ts';
import { TimeButton } from './bits.tsx';

interface Props {
  meetings: MeetingMeta[];
  onToggle: (meetingId: string, i: number, done: boolean) => void;
  onOpen: (id: string, focus?: { t: number }) => void;
  onNew: () => void;
}

type Filter = 'open' | 'done' | 'all';

export default function ActionItemsView({ meetings, onToggle, onOpen, onNew }: Props) {
  const [filter, setFilter] = useState<Filter>('open');
  const items = meetings.flatMap(m => (m.summary?.actions ?? []).map((a, i) => ({ a, i, m })));
  const shown = items.filter(({ a }) => (filter === 'all' ? true : filter === 'done' ? a.done : !a.done));
  const byOwner = new Map<string, typeof shown>();
  for (const it of shown) byOwner.set(it.a.owner, [...(byOwner.get(it.a.owner) ?? []), it]);
  const owners = [...byOwner].sort((x, y) => y[1].length - x[1].length);
  const openCount = items.filter(x => !x.a.done).length;

  return (
    <>
      <div className="list-head">
        <div style={{ display: 'grid', gap: 4 }}>
          <h1>Action Items</h1>
          <span className="parse-info">{openCount} open across {meetings.length} call{meetings.length === 1 ? '' : 's'}</span>
        </div>
        <div className="seg-control" role="group" aria-label="Filter">
          {(['open', 'done', 'all'] as Filter[]).map(f => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
      </div>
      {!items.length ? (
        <div className="empty">
          <h2>No action items yet</h2>
          <p>Action items appear here once a call has a summary.</p>
          {!meetings.length && <button className="btn primary" onClick={onNew}>Add a call</button>}
        </div>
      ) : !shown.length ? (
        <p className="parse-info">{filter === 'open' ? 'Everything is done.' : 'Nothing here yet.'}</p>
      ) : owners.map(([owner, list], oi) => (
        <section key={owner} className="card">
          <div className="owner-head">
            <span className="avatar" style={{ background: `var(--s${oi % 8})` }}>{initials(owner)}</span>
            <h3 className="grow">{owner}</h3>
            <span className="parse-info">{list.length}</span>
          </div>
          {list.map(({ a, i, m }) => {
            const id = `ai-${m.id}-${i}`;
            return (
              <div key={id} className={`action${a.done ? ' done' : ''}`}>
                <input type="checkbox" id={id} checked={a.done} onChange={e => onToggle(m.id, i, e.target.checked)} />
                <div>
                  <label htmlFor={id} className="txt">{a.text}</label>
                  <div className="who">
                    <button className="linkish" onClick={() => onOpen(m.id)}>{m.title}</button>
                    {a.due && <span>due {a.due}</span>}
                    <TimeButton t={a.t} onJump={t => onOpen(m.id, { t })} />
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
}
