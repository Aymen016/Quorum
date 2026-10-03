import { useEffect, useRef, useState } from 'react';
import type { ChatTurn, Meeting } from '../types.ts';
import { api } from '../api.ts';
import { LinkedTimes, SparkIcon } from './bits.tsx';

interface Props {
  meeting: Meeting | null;
  hasCalls: boolean;
  claude: boolean;
  onClose: () => void;
  onJump: (t: number) => void;
}

const SUGGEST_ALL = ['Surprise me with an insight', 'Next steps on projects?', "Things I promised I'd do by this week", 'Summarize my meetings from this week'];
const SUGGEST_CALL = ['What did we decide?', 'What is still unresolved?', 'Draft a follow-up email', 'Where did people disagree?'];

// Some models add markdown emphasis despite instructions; show it as plain text.
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#+\s+/gm, '');

// Conversations survive navigation within a session, keyed by scope.
const chats = new Map<string, ChatTurn[]>();

export default function AskPanel({ meeting, hasCalls, claude, onClose, onJump }: Props) {
  const [scope, setScope] = useState<'call' | 'all'>(meeting ? 'call' : 'all');
  const key = scope === 'call' && meeting ? meeting.id : 'all';
  const [, rerender] = useState(0);
  const turns = chats.get(key) ?? [];
  const setTurnsFor = (k: string, t: ChatTurn[]) => { chats.set(k, t); rerender(n => n + 1); };
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { body.current?.scrollTo({ top: body.current.scrollHeight }); });

  async function send(question: string) {
    const qText = question.trim();
    if (!qText || busy || !claude) return;
    const k = key;
    const history: ChatTurn[] = [...turns, { role: 'user', content: qText }];
    setTurnsFor(k, [...history, { role: 'assistant', content: '' }]);
    setDraft('');
    setBusy(true);
    abort.current = new AbortController();
    const put = (content: string) => setTurnsFor(k, [...history, { role: 'assistant', content }]);
    try {
      const text = await api.ask(k === 'all' ? null : k, history, put, abort.current.signal);
      put(text || 'No answer came back. Try rephrasing.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') put((e as Error).message);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  const suggestions = key === 'all' ? SUGGEST_ALL : SUGGEST_CALL;
  const disabledReason = !claude ? 'Add GROQ_API_KEY (free) or ANTHROPIC_API_KEY to web/.env to use Ask Fathom.' : !hasCalls ? 'Add a call to start asking questions.' : '';

  return (
    <aside className="ask-panel" aria-label="Ask Fathom">
      <div className="ask-head">
        <span className="ask-title"><SparkIcon /><span className="lite">ASK</span> FATHOM</span>
        <span className="grow" />
        {turns.length > 0 && <button className="btn ghost" onClick={() => { abort.current?.abort(); setTurnsFor(key, []); }}>New chat</button>}
        <button className="iconbtn" onClick={onClose} aria-label="Close Ask Fathom" title="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="1.5" y="2" width="13" height="12" rx="2" /><path d="M10 2v12M6 6l2 2-2 2" /></svg>
        </button>
      </div>

      <div className="ask-body" ref={body}>
        {turns.length === 0 ? (
          <>
            <p className="parse-info" style={{ margin: 0 }}>
              {key === 'all'
                ? 'Ask about any of your calls. Fathom reads every summary and transcript and tells you which call each answer comes from.'
                : `Ask about "${meeting?.title}". Answers cite timestamps you can click to jump to that moment.`}
            </p>
            <div className="spacer" />
            {!disabledReason && <div className="sugg">{suggestions.map(s => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>}
          </>
        ) : (
          turns.map((t, i) => t.role === 'user'
            ? <div key={i} className="msg me">{t.content}</div>
            : (
              <div key={i} className="msg ai">
                {t.content
                  ? (key === 'all' ? plain(t.content) : <LinkedTimes text={plain(t.content)} onJump={onJump} />)
                  : <span className="progress"><span className="spin" />Reading {key === 'all' ? 'your calls' : 'the transcript'}…</span>}
              </div>
            ))
        )}
      </div>

      <form className="ask-compose" onSubmit={e => { e.preventDefault(); send(draft); }}>
        <div className="ask-box">
          <textarea
            ref={input}
            id="askIn"
            rows={2}
            placeholder={disabledReason || 'Ask anything…'}
            value={draft}
            disabled={!!disabledReason || busy}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft); } }}
          />
          <div className="row">
            <select id="askScope" value={key === 'all' ? 'all' : 'call'} disabled={busy} onChange={e => setScope(e.target.value as 'call' | 'all')} aria-label="What to ask about">
              {meeting && <option value="call">This call</option>}
              <option value="all">My Calls</option>
            </select>
            {busy ? (
              <button type="button" className="btn" onClick={() => abort.current?.abort()}>Stop</button>
            ) : (
              <button className="send" disabled={!draft.trim() || !!disabledReason} aria-label="Send">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 12V2M2.5 6.5L7 2l4.5 4.5" /></svg>
              </button>
            )}
          </div>
        </div>
      </form>
    </aside>
  );
}
