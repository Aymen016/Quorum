import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.ts';
import type { Clip, Meeting, MeetingMeta } from './types.ts';
import TopBar, { type Page } from './components/TopBar.tsx';
import CallsList from './components/CallsList.tsx';
import CallView from './components/CallView.tsx';
import PlaylistsView from './components/PlaylistsView.tsx';
import TeamView from './components/TeamView.tsx';
import AlertsView from './components/AlertsView.tsx';
import DealsView from './components/DealsView.tsx';
import ActionItemsView from './components/ActionItemsView.tsx';
import SearchView from './components/SearchView.tsx';
import NewMeetingDialog from './components/NewMeetingDialog.tsx';
import AskPanel from './components/AskPanel.tsx';
import { SparkIcon } from './components/bits.tsx';
import { deleteRecording } from './media.ts';

export interface Focus { t: number; range?: [number, number]; nonce: number }

const readHash = (): { page: Page; call: string | null; clip: string | null } => {
  const h = location.hash.slice(1);
  if (h.startsWith('call-')) return { page: 'calls', call: h.slice(5), clip: null };
  if (h.startsWith('c-')) return { page: 'calls', call: null, clip: h.slice(2) };
  if (h === 'clips') return { page: 'playlists', call: null, clip: null };
  if (['team', 'playlists', 'alerts', 'deals', 'actions'].includes(h)) return { page: h as Page, call: null, clip: null };
  return { page: 'calls', call: null, clip: null };
};

export default function App() {
  const initial = useRef(readHash());
  const [claude, setClaude] = useState(false);
  const [provider, setProvider] = useState('');
  const [meetings, setMeetings] = useState<MeetingMeta[] | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [full, setFull] = useState<Record<string, Meeting>>({});
  const [page, setPage] = useState<Page>(initial.current.page);
  const [cur, setCur] = useState<string | null>(initial.current.call);
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState<Focus | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [askOpen, setAskOpen] = useState(() => window.innerWidth > 1180);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const toastTimer = useRef<number>();

  const say = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2400);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [ms, cs] = await Promise.all([api.meetings(), api.clips()]);
      setMeetings(ms);
      setClips(cs);
      setVersion(v => v + 1);
      setError('');
      // Keep cached transcripts, but take the latest status and minutes from the list.
      setFull(prev => {
        const next: Record<string, Meeting> = {};
        for (const m of ms) if (prev[m.id]) next[m.id] = { ...prev[m.id], ...m };
        return next;
      });
    } catch {
      setError('Cannot reach the Fathom server. Is `npm run dev` running?');
    }
  }, []);

  useEffect(() => {
    api.status().then(s => { setClaude(s.claude); setProvider(s.provider); }).catch(() => {});
    refresh();
  }, [refresh]);

  // Poll quickly while Claude is writing minutes, slowly otherwise.
  const busy = meetings?.some(m => m.status === 'summarizing');
  useEffect(() => {
    const id = window.setInterval(refresh, busy ? 2000 : 15000);
    return () => clearInterval(id);
  }, [busy, refresh]);

  const loadFull = useCallback(async (id: string) => {
    const m = await api.meeting(id);
    setFull(prev => ({ ...prev, [id]: m }));
    return m;
  }, []);

  useEffect(() => {
    if (cur && !full[cur]) loadFull(cur).catch(() => { setCur(null); history.replaceState(null, '', '#'); });
  }, [cur, full, loadFull]);

  const go = useCallback((p: Page, call: string | null = null, f?: Omit<Focus, 'nonce'>) => {
    setPage(p);
    setCur(call);
    setQ('');
    setFocus(f ? { ...f, nonce: Date.now() } : null);
    history.replaceState(null, '', call ? `#call-${call}` : p === 'calls' ? '#' : `#${p}`);
    document.querySelector('.pane')?.scrollTo(0, 0);
  }, []);
  const openCall = useCallback((id: string, f?: Omit<Focus, 'nonce'>) => go('calls', id, f), [go]);
  const openClip = useCallback((c: Clip) => {
    go('calls', c.meetingId, { t: c.start, range: [c.start, c.end] });
    history.replaceState(null, '', `#c-${c.id}`);
  }, [go]);

  // Deep link to a clip (#c-<id>) once clips have loaded.
  useEffect(() => {
    const id = initial.current.clip;
    if (!id || !clips.length) return;
    initial.current.clip = null;
    const c = clips.find(x => x.id === id);
    if (c) openClip(c);
  }, [clips, openClip]);

  const meta = cur ? meetings?.find(m => m.id === cur) : undefined;
  const meeting = cur && full[cur] ? ({ ...full[cur], ...meta } as Meeting) : undefined;

  const patchLocal = (id: string, patch: Partial<Meeting>) => {
    setFull(prev => (prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
    setMeetings(prev => prev?.map(m => (m.id === id ? { ...m, ...patch } : m)) ?? prev);
  };

  const toggleAction = async (id: string, i: number, done: boolean) => {
    const m = meetings?.find(x => x.id === id);
    if (!m?.summary) return;
    patchLocal(id, { summary: { ...m.summary, actions: m.summary.actions.map((a, j) => (j === i ? { ...a, done } : a)) } });
    try { await api.setDone(id, i, done); } catch { say('Could not save that change.'); refresh(); }
  };

  const openActions = meetings?.reduce((n, m) => n + (m.summary?.actions.filter(a => !a.done).length ?? 0), 0) ?? 0;

  let content: React.ReactNode;
  if (error) content = <div className="note">{error}</div>;
  else if (q) content = <SearchView q={q} meetings={meetings ?? []} full={full} loadFull={loadFull} onOpen={openCall} onClear={() => setQ('')} />;
  else if (cur && meeting) {
    content = (
      <CallView
        key={meeting.id}
        meeting={meeting}
        claude={claude}
        focus={focus}
        onBack={() => go('calls')}
        onSummarize={async () => {
          try { await api.summarize(meeting.id); patchLocal(meeting.id, { status: 'summarizing', statusText: 'Reading the transcript' }); refresh(); }
          catch (e) { say((e as Error).message); }
        }}
        onToggle={(i, done) => toggleAction(meeting.id, i, done)}
        onDelete={async () => { await api.remove(meeting.id); await deleteRecording(meeting.id); say('Call deleted'); go('calls'); refresh(); }}
        onClipSaved={c => setClips(prev => [c, ...prev])}
        say={say}
      />
    );
  } else if (cur || !meetings) content = <div className="progress"><span className="spin" />Loading</div>;
  else if (page === 'team') content = <TeamView meetings={meetings} version={version} onOpen={openCall} />;
  else if (page === 'playlists') content = <PlaylistsView clips={clips} meetings={meetings} full={full} loadFull={loadFull} onOpenClip={openClip} onClipsChanged={refresh} say={say} />;
  else if (page === 'alerts') content = <AlertsView version={version} onOpen={openCall} say={say} />;
  else if (page === 'deals') content = <DealsView meetings={meetings} onOpen={openCall} say={say} />;
  else if (page === 'actions') content = <ActionItemsView meetings={meetings} onToggle={toggleAction} onOpen={openCall} onNew={() => setShowNew(true)} />;
  else content = <CallsList meetings={meetings} onOpen={openCall} onNew={() => setShowNew(true)} />;

  return (
    <div className="shell">
      <TopBar
        page={cur ? 'calls' : page}
        q={q}
        onQ={setQ}
        onNav={p => go(p)}
        onNew={() => setShowNew(true)}
        claude={claude}
        provider={provider}
        counts={{ calls: meetings?.length ?? 0, playlists: clips.length, actions: openActions }}
      />
      <div className={`workspace${askOpen ? '' : ' ask-collapsed'}`}>
        <main className="pane">
          <div className="pane-inner">
            {!claude && meetings && (
              <p className="note gold" style={{ margin: 0 }}>
                <b>AI is off.</b> Add a free <code>GROQ_API_KEY=…</code> (or <code>ANTHROPIC_API_KEY=…</code>) to <code>web/.env</code> and restart <code>npm run dev</code> to get
                summaries, catch-ups and Ask Fathom. Calls, transcripts, search and clips work without it.
              </p>
            )}
            {content}
          </div>
        </main>
        <AskPanel
          key={meeting ? meeting.id : 'all'}
          meeting={meeting ?? null}
          hasCalls={!!meetings?.length}
          claude={claude}
          onClose={() => setAskOpen(false)}
          onJump={t => meeting && openCall(meeting.id, { t })}
        />
      </div>
      {!askOpen && (
        <button className="btn primary ask-fab" onClick={() => setAskOpen(true)}><SparkIcon />Ask Fathom</button>
      )}
      {showNew && (
        <NewMeetingDialog
          claude={claude}
          onClose={() => setShowNew(false)}
          onCreated={async m => { setShowNew(false); await refresh(); openCall(m.id); }}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
