import { TALK_BUCKETS, type MeetingMeta } from '../types.ts';
import { fmt, fmtDur } from '../util.ts';
import { Avatars, speakerColor } from './bits.tsx';

interface Props { meetings: MeetingMeta[]; onOpen: (id: string) => void; onNew: () => void }

function groupOf(date: number) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (date >= startOfDay) return 'Today';
  if (date >= startOfDay - 86400000) return 'Yesterday';
  if (date >= startOfDay - 6 * 86400000) return 'This week';
  if (new Date(date).getFullYear() === now.getFullYear()) return new Date(date).toLocaleString(undefined, { month: 'long' });
  return String(new Date(date).getFullYear());
}

export default function CallsList({ meetings, onOpen, onNew }: Props) {
  if (!meetings.length) {
    return (
      <div className="empty">
        <svg className="glyph" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 16l8-8" /></svg>
        <h2>No call recordings</h2>
        <p>Add a transcript from Zoom, Google Meet, Teams or any captions file. You'll get a summary, action items, and a catch-up for everyone on the call.</p>
        <button className="btn primary" onClick={onNew}>Add your first call</button>
      </div>
    );
  }

  const groups = new Map<string, MeetingMeta[]>();
  for (const m of meetings) {
    const g = groupOf(m.date);
    groups.set(g, [...(groups.get(g) ?? []), m]);
  }

  return (
    <>
      <div className="list-head">
        <h1>My Calls</h1>
        <span className="parse-info">{meetings.length} call{meetings.length === 1 ? '' : 's'} · {fmtDur(meetings.reduce((s, m) => s + m.duration, 0))} recorded</span>
      </div>
      {[...groups].map(([name, ms]) => (
        <section key={name} className="group">
          <h2 className="group-title">{name}</h2>
          {ms.map(m => <CallCard key={m.id} m={m} onOpen={onOpen} />)}
        </section>
      ))}
    </>
  );
}

export function CallCard({ m, onOpen }: { m: MeetingMeta; onOpen: (id: string) => void }) {
  const open = m.summary?.actions.filter(a => !a.done).length ?? 0;
  return (
    <button className="callcard" onClick={() => onOpen(m.id)}>
      <div className="thumb" aria-hidden="true">
        {m.speakers.slice(0, 6).map((s, i) => (
          <div key={s} className="thumb-row">
            {(m.talkMap?.[i] ?? []).map(k => (
              <i key={k} style={{ left: `${(k / TALK_BUCKETS) * 100}%`, width: `${100 / TALK_BUCKETS}%`, background: speakerColor(m.speakers, s) }} />
            ))}
          </div>
        ))}
        <span className="dur">{fmt(m.duration)}</span>
      </div>
      <div className="callbody">
        <h3>{m.title}</h3>
        <div className="callmeta">
          <span>{new Date(m.date).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
          <Avatars names={m.speakers} all={m.speakers} />
          {m.status === 'summarizing' ? <span className="pill live"><span className="spin" style={{ width: 10, height: 10 }} />Summarizing</span>
            : m.status === 'failed' ? <span className="pill bad">Summary failed</span>
            : open > 0 ? <span className="pill">{open} open action item{open === 1 ? '' : 's'}</span>
            : m.summary ? <span className="pill good">All actions done</span> : null}
          {m.example && <span className="pill">Example</span>}
        </div>
        {m.summary?.overview && <p className="snippet">{m.summary.overview}</p>}
      </div>
    </button>
  );
}
