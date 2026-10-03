import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import type { Clip, Meeting, MeetingMeta, Playlist } from '../types.ts';
import { fmt, fmtDur } from '../util.ts';

interface Props {
  clips: Clip[];
  meetings: MeetingMeta[];
  full: Record<string, Meeting>;
  loadFull: (id: string) => Promise<Meeting>;
  onOpenClip: (c: Clip) => void;
  onClipsChanged: () => void;
  say: (msg: string) => void;
}

export default function PlaylistsView({ clips, meetings, full, loadFull, onOpenClip, onClipsChanged, say }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const load = () => api.playlists().then(ps => { setPlaylists(ps); return ps; });
  useEffect(() => { load().catch(() => setPlaylists([])); }, [clips.length]);

  // Quotes need the transcripts of the calls the clips come from.
  const needed = [...new Set(clips.map(c => c.meetingId))].filter(id => !full[id] && meetings.some(m => m.id === id));
  useEffect(() => { needed.forEach(id => loadFull(id).catch(() => {})); }, [needed.join(','), loadFull]); // eslint-disable-line react-hooks/exhaustive-deps

  const clipById = new Map(clips.map(c => [c.id, c]));
  const titles = new Map(meetings.map(m => [m.id, m.title]));
  const quote = (c: Clip) => full[c.meetingId]?.lines.filter(l => l.t >= c.start && l.t < c.end).slice(0, 3).map(l => `${l.s}: ${l.x}`).join(' ');
  const pl = playlists?.find(p => p.id === picked) ?? null;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try { const p = await api.createPlaylist(name.trim()); setName(''); await load(); setPicked(p.id); say(`Created "${p.name}"`); }
    catch (err) { say((err as Error).message); }
  };
  const setClips = async (p: Playlist, clipIds: string[]) => {
    setPlaylists(ps => ps?.map(x => (x.id === p.id ? { ...x, clipIds } : x)) ?? ps);
    try { await api.updatePlaylist(p.id, { clipIds }); } catch (err) { say((err as Error).message); load(); }
  };
  const addTo = (playlistId: string, clipId: string) => {
    const p = playlists?.find(x => x.id === playlistId);
    if (!p) return;
    if (p.clipIds.includes(clipId)) { say(`Already in "${p.name}"`); return; }
    setClips(p, [...p.clipIds, clipId]).then(() => say(`Added to "${p.name}"`));
  };
  const move = (p: Playlist, i: number, d: -1 | 1) => {
    const ids = [...p.clipIds];
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    setClips(p, ids);
  };
  const share = async (p: Playlist) => {
    const text = `${p.name}\n${p.description ? p.description + '\n' : ''}\n` + p.clipIds.map((id, i) => {
      const c = clipById.get(id);
      return c ? `${i + 1}. ${c.title} — ${titles.get(c.meetingId) ?? ''} (${fmt(c.start)}–${fmt(c.end)})\n   ${location.origin}/#c-${c.id}` : '';
    }).filter(Boolean).join('\n');
    try { await navigator.clipboard.writeText(text); say('Playlist copied'); } catch { say('Copy is blocked in this browser'); }
  };
  const removeClip = async (c: Clip) => {
    try { await api.removeClip(c.id); onClipsChanged(); say('Clip deleted'); } catch (err) { say((err as Error).message); }
  };

  if (!playlists) return <div className="progress"><span className="spin" />Loading playlists</div>;

  return (
    <>
      <div className="list-head">
        <div style={{ display: 'grid', gap: 4 }}>
          <h1>Playlists</h1>
          <span className="parse-info">Save highlights from your calls into shareable collections: feedback themes, training moments, customer quotes.</span>
        </div>
      </div>

      <form className="inline-form" onSubmit={create}>
        <input id="plName" placeholder="New playlist name, e.g. Customer pain points" value={name} onChange={e => setName(e.target.value)} />
        <button className="btn primary" disabled={!name.trim()}>Create playlist</button>
      </form>

      {playlists.length > 0 && (
        <div className="pl-grid">
          {playlists.map(p => {
            const dur = p.clipIds.reduce((s, id) => { const c = clipById.get(id); return s + (c ? c.end - c.start : 0); }, 0);
            return (
              <button key={p.id} className={`plcard${picked === p.id ? ' on' : ''}`} onClick={() => { setPicked(picked === p.id ? null : p.id); setConfirmDel(false); }}>
                <span className="stack" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h12M4 12h12M4 18h7M17 15l4 3-4 3z" /></svg>
                </span>
                <b>{p.name}</b>
                <span className="parse-info">{p.clipIds.length} clip{p.clipIds.length === 1 ? '' : 's'} · {fmtDur(dur)}</span>
              </button>
            );
          })}
        </div>
      )}

      {pl && (
        <section className="panel-card">
          <div className="row">
            <div className="grow" style={{ display: 'grid', gap: 2 }}>
              <h2 style={{ fontSize: 20 }}>{pl.name}</h2>
              {pl.description && <span className="parse-info">{pl.description}</span>}
            </div>
            <button className="btn" onClick={() => share(pl)} disabled={!pl.clipIds.length}>Copy to share</button>
            <button className="btn ghost danger" onClick={() => setConfirmDel(true)}>Delete</button>
          </div>
          {confirmDel && (
            <div className="confirm">
              <span className="grow">Delete “{pl.name}”? The clips themselves stay.</span>
              <button className="btn danger" onClick={async () => { await api.removePlaylist(pl.id); setPicked(null); setConfirmDel(false); load(); say('Playlist deleted'); }}>Delete playlist</button>
              <button className="btn ghost" onClick={() => setConfirmDel(false)}>Keep</button>
            </div>
          )}
          {!pl.clipIds.length ? (
            <p className="parse-info" style={{ margin: 0 }}>Empty. Use “Add to playlist” on any clip below.</p>
          ) : (
            <div>
              {pl.clipIds.map((id, i) => {
                const c = clipById.get(id);
                if (!c) return null;
                return (
                  <div key={id} className="pl-item">
                    <span className="idx">{i + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      <button className="linkish" style={{ color: 'var(--fg)', fontWeight: 600, textDecoration: 'none' }} onClick={() => onOpenClip(c)}>{c.title}</button>
                      <div className="parse-info">{titles.get(c.meetingId) ?? 'Deleted call'} · <span className="mono">{fmt(c.start)}–{fmt(c.end)}</span></div>
                      {quote(c) && <blockquote>{quote(c)}</blockquote>}
                    </div>
                    <span className="pl-tools">
                      <button className="iconbtn" disabled={i === 0} onClick={() => move(pl, i, -1)} aria-label="Move up">↑</button>
                      <button className="iconbtn" disabled={i === pl.clipIds.length - 1} onClick={() => move(pl, i, 1)} aria-label="Move down">↓</button>
                      <button className="iconbtn" onClick={() => setClips(pl, pl.clipIds.filter(x => x !== id))} aria-label="Remove from playlist" title="Remove from playlist">×</button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="sec">
        <h3>All clips <span className="pill">{clips.length}</span></h3>
        {!clips.length ? (
          <p className="parse-info" style={{ margin: 0 }}>No clips yet. Open a call, go to the Transcript tab and use “Make a clip”.</p>
        ) : (
          <div className="clip-grid">
            {clips.map(c => (
              <div key={c.id} className="clipcard">
                <span className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="pill live mono">{fmt(c.start)}–{fmt(c.end)}</span>
                  <span className="parse-info">{new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </span>
                <button className="linkish" style={{ textAlign: 'left', color: 'var(--fg)', fontSize: 15, fontWeight: 600, textDecoration: 'none' }} onClick={() => onOpenClip(c)}>{c.title}</button>
                <span className="parse-info">{titles.get(c.meetingId) ?? 'Deleted call'}</span>
                {quote(c) && <blockquote>{quote(c)}</blockquote>}
                <div className="clip-actions">
                  {playlists.length > 0 && (
                    <select aria-label="Add to playlist" value="" onChange={e => e.target.value && addTo(e.target.value, c.id)}>
                      <option value="">Add to playlist…</option>
                      {playlists.map(p => <option key={p.id} value={p.id}>{p.name}{p.clipIds.includes(c.id) ? ' ✓' : ''}</option>)}
                    </select>
                  )}
                  <span className="grow" />
                  <button className="btn ghost danger" onClick={() => removeClip(c)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
