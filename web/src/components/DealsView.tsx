import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import { DEAL_STAGES, type Deal, type DealStage, type MeetingMeta } from '../types.ts';
import { TimeButton } from './bits.tsx';

interface Props {
  meetings: MeetingMeta[];
  onOpen: (id: string, focus?: { t: number }) => void;
  say: (msg: string) => void;
}

const money = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function DealsView({ meetings, onOpen, say }: Props) {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', company: '', value: '', stage: 'Discovery' as DealStage, meetingId: '' });
  const [confirmDel, setConfirmDel] = useState(false);

  const load = () => api.deals().then(setDeals);
  useEffect(() => { load().catch(() => setDeals([])); }, []);

  const byId = new Map(meetings.map(m => [m.id, m]));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const d = await api.createDeal({ name: form.name.trim(), company: form.company.trim(), value: Number(form.value) || 0, stage: form.stage, meetingIds: form.meetingId ? [form.meetingId] : [] });
      setForm({ name: '', company: '', value: '', stage: 'Discovery', meetingId: '' });
      await load();
      setPicked(d.id);
      say(`Created "${d.name}"`);
    } catch (err) { say((err as Error).message); }
  };
  const update = async (d: Deal, patch: Partial<Deal>) => {
    setDeals(ds => ds?.map(x => (x.id === d.id ? { ...x, ...patch } : x)) ?? ds);
    try { await api.updateDeal(d.id, patch); } catch (err) { say((err as Error).message); load(); }
  };

  if (!deals) return <div className="progress"><span className="spin" />Loading deals</div>;
  const deal = deals.find(d => d.id === picked) ?? null;
  const openPipeline = deals.filter(d => d.stage !== 'Won' && d.stage !== 'Lost');

  return (
    <>
      <div className="list-head">
        <div style={{ display: 'grid', gap: 4 }}>
          <h1>Deals</h1>
          <span className="parse-info">Link calls to deals to see every conversation, open action item and next step for an opportunity in one place.</span>
        </div>
        {deals.length > 0 && <span className="parse-info">{openPipeline.length} open · {money(openPipeline.reduce((s, d) => s + d.value, 0))} in pipeline</span>}
      </div>

      <form className="inline-form" onSubmit={create}>
        <input id="dealName" placeholder="Deal name, e.g. Acme renewal" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input id="dealCompany" placeholder="Company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} style={{ flexBasis: 140 }} />
        <input id="dealValue" placeholder="Value ($)" inputMode="numeric" value={form.value} onChange={e => setForm({ ...form, value: e.target.value.replace(/[^\d]/g, '') })} style={{ flex: '0 1 120px' }} />
        <select id="dealStage" value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value as DealStage })} aria-label="Stage">
          {DEAL_STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select id="dealCall" value={form.meetingId} onChange={e => setForm({ ...form, meetingId: e.target.value })} aria-label="Link a call">
          <option value="">Link a call (optional)</option>
          {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
        <button className="btn primary" disabled={!form.name.trim()}>Add deal</button>
      </form>

      {!deals.length ? (
        <div className="empty"><h2>No deals yet</h2><p>Add a deal above and link the calls where it came up. You'll see its open action items and latest summary here.</p></div>
      ) : (
        <div className="board">
          {DEAL_STAGES.map(stage => {
            const list = deals.filter(d => d.stage === stage);
            return (
              <div key={stage} className="col">
                <div className="col-head">
                  <b className={stage === 'Won' ? 'stage-won' : stage === 'Lost' ? 'stage-lost' : ''}>{stage}</b>
                  <span>{list.length} · {money(list.reduce((s, d) => s + d.value, 0))}</span>
                </div>
                {list.map(d => {
                  const open = d.meetingIds.reduce((n, id) => n + (byId.get(id)?.summary?.actions.filter(a => !a.done).length ?? 0), 0);
                  const last = Math.max(0, ...d.meetingIds.map(id => byId.get(id)?.date ?? 0));
                  return (
                    <button key={d.id} className={`dealcard${picked === d.id ? ' on' : ''}`} onClick={() => { setPicked(picked === d.id ? null : d.id); setConfirmDel(false); }}>
                      <b>{d.name}</b>
                      <span className="v">{money(d.value)}</span>
                      <span className="sub">
                        {d.company && <span>{d.company}</span>}
                        <span>{d.meetingIds.length} call{d.meetingIds.length === 1 ? '' : 's'}</span>
                        {open > 0 && <span>{open} open item{open === 1 ? '' : 's'}</span>}
                        {last > 0 && <span>last {new Date(last).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {deal && <DealDetail key={deal.id} deal={deal} meetings={meetings} byId={byId} onUpdate={p => update(deal, p)} onOpen={onOpen}
        confirmDel={confirmDel} setConfirmDel={setConfirmDel}
        onDelete={async () => { await api.removeDeal(deal.id); setPicked(null); setConfirmDel(false); load(); say('Deal deleted'); }} />}
    </>
  );
}

interface DetailProps {
  deal: Deal;
  meetings: MeetingMeta[];
  byId: Map<string, MeetingMeta>;
  onUpdate: (p: Partial<Deal>) => void;
  onOpen: (id: string, focus?: { t: number }) => void;
  confirmDel: boolean;
  setConfirmDel: (v: boolean) => void;
  onDelete: () => void;
}

function DealDetail({ deal: d, meetings, byId, onUpdate, onOpen, confirmDel, setConfirmDel, onDelete }: DetailProps) {
  const [name, setName] = useState(d.name);
  const [company, setCompany] = useState(d.company);
  const [value, setValue] = useState(String(d.value || ''));
  const linked = d.meetingIds.map(id => byId.get(id)).filter((m): m is MeetingMeta => !!m).sort((a, b) => b.date - a.date);
  const unlinked = meetings.filter(m => !d.meetingIds.includes(m.id));
  const openItems = linked.flatMap(m => (m.summary?.actions ?? []).filter(a => !a.done).map(a => ({ a, m })));
  const latest = linked.find(m => m.summary);

  return (
    <section className="panel-card">
      <div className="row">
        <h2 className="grow" style={{ fontSize: 20 }}>{d.name}</h2>
        <button className="btn ghost danger" onClick={() => setConfirmDel(true)}>Delete deal</button>
      </div>
      {confirmDel && (
        <div className="confirm">
          <span className="grow">Delete “{d.name}”? Linked calls are not affected.</span>
          <button className="btn danger" onClick={onDelete}>Delete deal</button>
          <button className="btn ghost" onClick={() => setConfirmDel(false)}>Keep</button>
        </div>
      )}
      <div className="deal-detail">
        <div className="sec">
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <label className="field">Name<input value={name} onChange={e => setName(e.target.value)} onBlur={() => name.trim() && name !== d.name && onUpdate({ name: name.trim() })} /></label>
            <label className="field">Company<input value={company} onChange={e => setCompany(e.target.value)} onBlur={() => company !== d.company && onUpdate({ company })} /></label>
            <label className="field">Value ($)<input inputMode="numeric" value={value} onChange={e => setValue(e.target.value.replace(/[^\d]/g, ''))} onBlur={() => Number(value) !== d.value && onUpdate({ value: Number(value) || 0 })} /></label>
            <label className="field">Stage
              <select value={d.stage} onChange={e => onUpdate({ stage: e.target.value as DealStage })}>{DEAL_STAGES.map(s => <option key={s}>{s}</option>)}</select>
            </label>
          </div>
          <h3>Calls <span className="pill">{linked.length}</span></h3>
          <div>
            {linked.map(m => (
              <div key={m.id} className="linked">
                <div style={{ minWidth: 0 }}>
                  <button className="linkish" style={{ color: 'var(--fg)', fontWeight: 600, textDecoration: 'none' }} onClick={() => onOpen(m.id)}>{m.title}</button>
                  <div className="parse-info">{new Date(m.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {m.speakers.length} attendees</div>
                </div>
                <button className="btn ghost" onClick={() => onUpdate({ meetingIds: d.meetingIds.filter(x => x !== m.id) })}>Unlink</button>
              </div>
            ))}
            {!linked.length && <p className="parse-info" style={{ margin: 0 }}>No calls linked yet.</p>}
          </div>
          {unlinked.length > 0 && (
            <div className="inline-form">
              <select aria-label="Link a call" value="" onChange={e => e.target.value && onUpdate({ meetingIds: [...d.meetingIds, e.target.value] })} style={{ flex: 1 }}>
                <option value="">Link another call…</option>
                {unlinked.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="sec">
          <h3>Open action items <span className="pill">{openItems.length}</span></h3>
          <div>
            {openItems.map(({ a, m }, i) => (
              <div key={i} className="action">
                <span className="dot" style={{ background: 'var(--accent)', marginTop: 7 }} />
                <div>
                  <span>{a.text}</span>
                  <div className="who">{a.owner}{a.due ? ` · due ${a.due}` : ''}<TimeButton t={a.t} onJump={t => onOpen(m.id, { t })} /></div>
                </div>
              </div>
            ))}
            {!openItems.length && <p className="parse-info" style={{ margin: 0 }}>{linked.length ? 'Nothing open on the linked calls.' : 'Link a call to see its action items.'}</p>}
          </div>
          {latest?.summary && (
            <>
              <h3>Latest call summary</h3>
              <p style={{ margin: 0, color: 'var(--fg-2)' }}>{latest.summary.overview}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
