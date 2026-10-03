import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import type { Alert, AlertMatch } from '../types.ts';
import { Highlight, TimeButton } from './bits.tsx';

interface Props { version: number; onOpen: (id: string, focus?: { t: number }) => void; say: (msg: string) => void }

export default function AlertsView({ version, onOpen, say }: Props) {
  const [data, setData] = useState<{ alerts: Alert[]; matches: AlertMatch[] } | null>(null);
  const [draft, setDraft] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = () => api.alerts().then(setData).catch(e => setError((e as Error).message));
  useEffect(() => { load(); }, [version]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    try { const a = await api.createAlert(draft.trim()); setDraft(''); setPicked(a.id); await load(); say(`Tracking "${a.keyword}"`); }
    catch (err) { say((err as Error).message); }
  };
  const remove = async (a: Alert) => {
    try { await api.removeAlert(a.id); if (picked === a.id) setPicked(null); await load(); say(`Stopped tracking "${a.keyword}"`); }
    catch (err) { say((err as Error).message); }
  };

  if (error) return <div className="note">{error}</div>;
  if (!data) return <div className="progress"><span className="spin" />Loading alerts</div>;

  const count = (id: string) => data.matches.filter(m => m.alertId === id).length;
  const active = picked ? data.alerts.find(a => a.id === picked) : null;
  const shown = data.matches.filter(m => !picked || m.alertId === picked);
  const keywordOf = new Map(data.alerts.map(a => [a.id, a.keyword]));
  const groups = new Map<string, AlertMatch[]>();
  for (const m of shown) groups.set(m.meetingId, [...(groups.get(m.meetingId) ?? []), m]);

  return (
    <>
      <div className="list-head">
        <div style={{ display: 'grid', gap: 4 }}>
          <h1>Alerts</h1>
          <span className="parse-info">Track the words that matter, like a competitor, “pricing” or “cancel”, and see every time they come up in a call.</span>
        </div>
      </div>

      <form className="inline-form" onSubmit={add}>
        <input id="alertKw" placeholder="Add a keyword or phrase to track, e.g. pricing" value={draft} onChange={e => setDraft(e.target.value)} />
        <button className="btn primary" disabled={!draft.trim()}>Track keyword</button>
      </form>

      {data.alerts.length > 0 && (
        <div className="kw-row">
          <span className={`kw${!picked ? ' on' : ''}`}><button onClick={() => setPicked(null)}>All keywords <span className="n">{data.matches.length}</span></button><span style={{ width: 8 }} /></span>
          {data.alerts.map(a => (
            <span key={a.id} className={`kw${picked === a.id ? ' on' : ''}`}>
              <button onClick={() => setPicked(a.id)}>{a.keyword} <span className="n">{count(a.id)}</span></button>
              <button className="x" onClick={() => remove(a)} aria-label={`Stop tracking ${a.keyword}`} title="Stop tracking">×</button>
            </span>
          ))}
        </div>
      )}

      {!data.alerts.length ? (
        <div className="empty"><h2>No alerts yet</h2><p>Add a keyword above. Fathom checks every call you've added and every new one.</p></div>
      ) : !shown.length ? (
        <p className="parse-info">{active ? `“${active.keyword}” hasn't come up in any call yet.` : 'None of your keywords have come up yet.'}</p>
      ) : (
        <>
          <span className="parse-info">{shown.length} mention{shown.length === 1 ? '' : 's'} in {groups.size} call{groups.size === 1 ? '' : 's'}</span>
          {[...groups].map(([meetingId, list]) => (
            <section key={meetingId} className="card mention-group">
              <div className="mention-head">
                <h3><button className="linkish" style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)' }} onClick={() => onOpen(meetingId)}>{list[0].title}</button></h3>
                <span className="parse-info">{new Date(list[0].date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              </div>
              {list.map((m, i) => (
                <div key={i} className="moment">
                  <TimeButton t={m.t} onJump={t => onOpen(meetingId, { t })} />
                  <div>
                    <b style={{ fontWeight: 600 }}>{m.s}</b>{!picked && <span className="pill" style={{ marginLeft: 8 }}>{keywordOf.get(m.alertId)}</span>}
                    <div style={{ color: 'var(--fg-2)' }}><Highlight text={m.x} q={keywordOf.get(m.alertId) ?? ''} /></div>
                  </div>
                </div>
              ))}
            </section>
          ))}
        </>
      )}
    </>
  );
}
