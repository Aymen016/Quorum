import { useCallback, useEffect, useRef, useState } from 'react';
import type { Clip, Meeting } from '../types.ts';
import type { Focus } from '../App.tsx';
import { fmt, fmtDate, fmtDur } from '../util.ts';
import Timeline from './Timeline.tsx';
import Minutes from './Minutes.tsx';
import Catchup from './Catchup.tsx';
import Transcript from './Transcript.tsx';
import { Avatars, Spinner } from './bits.tsx';
import Player from './Player.tsx';

type Tab = 'summary' | 'catchup' | 'transcript';
const TABS: [Tab, string][] = [['summary', 'Summary'], ['catchup', 'Catch-up'], ['transcript', 'Transcript']];

interface Props {
  meeting: Meeting;
  claude: boolean;
  focus: Focus | null;
  onBack: () => void;
  onSummarize: () => void;
  onToggle: (i: number, done: boolean) => void;
  onDelete: () => Promise<void>;
  onClipSaved: (c: Clip) => void;
  say: (msg: string) => void;
}

const readTab = (): Tab => {
  try {
    const t = localStorage.getItem('f.tab') as Tab;
    return TABS.some(([k]) => k === t) ? t : 'summary';
  } catch { return 'summary'; }
};

export default function CallView({ meeting: m, claude, focus, onBack, onSummarize, onToggle, onDelete, onClipSaved, say }: Props) {
  const [tab, setTabState] = useState<Tab>(focus ? 'transcript' : readTab);
  const [jump, setJump] = useState<Focus | null>(focus);
  const [confirmDel, setConfirmDel] = useState(false);
  const media = useRef<HTMLMediaElement>(null);
  const [now, setNow] = useState<number | null>(null);
  const onTime = useCallback((t: number | null) => setNow(t), []);

  useEffect(() => { if (focus) { setTabState('transcript'); setJump(focus); } }, [focus]);

  const setTab = (t: Tab) => {
    setTabState(t);
    try { localStorage.setItem('f.tab', t); } catch { /* storage blocked */ }
  };
  // Jumping moves the recording (when attached) and the transcript to the same moment.
  const onJump = (t: number) => {
    if (media.current) { media.current.currentTime = t; media.current.play().catch(() => {}); }
    setTabState('transcript');
    setJump({ t, nonce: Date.now() });
  };

  const summarizing = m.status === 'summarizing';
  const s = m.summary;

  const copySummary = async () => {
    if (!s) return;
    const text = `${m.title}\n${fmtDate(m.date)} · ${fmtDur(m.duration)} · ${m.speakers.join(', ')}\n\nSUMMARY\n${s.overview}\n\nDECISIONS\n${s.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nACTION ITEMS\n${s.actions.map(a => `[${a.done ? 'x' : ' '}] ${a.owner}: ${a.text}${a.due ? ` (due ${a.due})` : ''}`).join('\n')}\n\nCHAPTERS\n${s.chapters.map(c => `${fmt(c.start)} ${c.title}: ${c.summary}`).join('\n')}`;
    try { await navigator.clipboard.writeText(text); say('Summary copied'); } catch { say('Copy is blocked in this browser'); }
  };

  const status = (
    <div className="card">
      {summarizing ? (
        <div className="progress"><Spinner />{m.statusText || 'Reading the transcript'}. Long calls take a minute or two.</div>
      ) : m.status === 'failed' ? (
        <>
          <p style={{ margin: 0 }}>{m.statusText || 'The summary did not finish.'}</p>
          {claude && <div><button className="btn primary" onClick={onSummarize}>Try again</button></div>}
        </>
      ) : (
        <>
          <p style={{ margin: 0 }}>No summary yet. {claude ? 'Have the AI read the transcript and write one.' : 'Add a Groq or Anthropic API key to generate one.'}</p>
          {claude && <div><button className="btn primary" onClick={onSummarize}>Generate summary</button></div>}
        </>
      )}
    </div>
  );

  return (
    <>
      <button className="btn ghost back" onClick={onBack}>← My Calls</button>
      <header className="mhead">
        <div className="row">
          <span className="eyebrow">{fmtDate(m.date)}</span>
          {m.example && <span className="pill">Example call</span>}
        </div>
        <h2>{m.title}</h2>
        <div className="meta">
          <Avatars names={m.speakers} all={m.speakers} max={6} />
          <span><b className="mono">{fmtDur(m.duration)}</b></span>
          <span><b>{m.speakers.length}</b> attendees</span>
          <span><b>{m.lineCount}</b> turns</span>
          {s && <span><b>{s.actions.length}</b> action items</span>}
        </div>
        <div className="head-actions">
          {s && <button className="btn" onClick={copySummary}>Copy summary</button>}
          {claude && !summarizing && <button className="btn" onClick={onSummarize}>{s ? 'Regenerate summary' : 'Generate summary'}</button>}
          <button className="btn ghost danger" onClick={() => setConfirmDel(true)}>Delete</button>
        </div>
        {confirmDel && (
          <div className="confirm">
            <span className="grow">Delete this call, its transcript and its clips?</span>
            <button className="btn danger" onClick={() => onDelete().catch(() => say('Could not delete the call.'))}>Delete call</button>
            <button className="btn ghost" onClick={() => setConfirmDel(false)}>Keep</button>
          </div>
        )}
      </header>

      <Player ref={media} meetingId={m.id} onTime={onTime} say={say} />

      <Timeline meeting={m} onJump={onJump} now={now} />

      <nav className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} className={`tab${tab === k ? ' on' : ''}`} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>

      <div>
        {tab === 'summary' && (s ? <Minutes meeting={m} onJump={onJump} onToggle={onToggle} /> : status)}
        {tab === 'catchup' && <Catchup meeting={m} onJump={onJump} status={s ? null : status} />}
        {tab === 'transcript' && <Transcript meeting={m} jump={jump} now={now} onClipSaved={onClipSaved} say={say} />}
      </div>
    </>
  );
}
