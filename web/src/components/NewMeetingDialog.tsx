import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.ts';
import type { MeetingMeta } from '../types.ts';
import { fmtDur, parseTranscript } from '../util.ts';
import { Spinner } from './bits.tsx';
import { isMedia, saveRecording } from '../media.ts';

interface Props { claude: boolean; onClose: () => void; onCreated: (m: MeetingMeta) => void }

const localNow = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function NewMeetingDialog({ claude, onClose, onCreated }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(localNow);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState<File | null>(null);

  useEffect(() => { ref.current?.showModal(); }, []);

  const parsed = useMemo(() => (text.trim() ? parseTranscript(text) : null), [text]);
  const ok = !!parsed && parsed.lines.length >= 2;

  const onFile = async (f?: File) => {
    if (!f) return;
    setText(await f.text());
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed || !ok) return;
    setSaving(true);
    setError('');
    try {
      const m = await api.create({
        title: title.trim() || 'Untitled call',
        date: date ? new Date(date).getTime() : Date.now(),
        lines: parsed.lines,
        speakers: parsed.speakers,
        duration: parsed.duration,
      });
      if (recording) await saveRecording(m.id, recording);
      onCreated(m);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose}>
      <form className="dlg" onSubmit={submit}>
        <div className="row">
          <h2 className="grow" style={{ fontSize: 22 }}>Add a call</h2>
          <button type="button" className="btn ghost" onClick={onClose}>Close</button>
        </div>
        <label>Title<input type="text" id="nmTitle" placeholder="Weekly product sync" value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label>When<input type="datetime-local" id="nmDate" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label>Transcript
          <textarea id="nmText" value={text} onChange={e => setText(e.target.value)}
            placeholder={'Paste a transcript. Fathom reads Zoom, Meet, Teams, Otter and Fathom exports, plus .vtt and .srt captions.\n\n[00:00:04] Priya Shah: Okay, let\'s get started.\n[00:00:09] Marcus Lee: Before we start, quick update on hiring…'} />
        </label>
        <div className="row">
          <label className="btn" htmlFor="nmFile" style={{ display: 'inline-flex' }}>Upload file</label>
          <input type="file" id="nmFile" accept=".txt,.vtt,.srt,.md,text/plain" hidden onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          <span className="parse-info grow">
            {!parsed ? 'Paste or upload a transcript to see what Fathom detects.'
              : ok ? `Found ${parsed.lines.length} turns · ${parsed.speakers.length} speakers (${parsed.speakers.slice(0, 5).join(', ')}${parsed.speakers.length > 5 ? '…' : ''}) · ${fmtDur(parsed.duration)}`
              : 'Could not find speaker turns. Use one line per turn, like "Name: what they said".'}
          </span>
        </div>
        <div className="row">
          <label className="btn" htmlFor="nmRec" style={{ display: 'inline-flex' }}>{recording ? 'Change recording' : 'Attach recording (optional)'}</label>
          <input type="file" id="nmRec" accept="video/*,audio/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f && isMedia(f)) setRecording(f); else if (f) setError('Choose a video or audio file.'); e.target.value = ''; }} />
          <span className="parse-info grow">{recording ? `${recording.name} · ${(recording.size / 1048576).toFixed(1)} MB · kept in this browser` : 'Video or audio of the call, played back in sync with the transcript.'}</span>
        </div>
        <p className="parse-info" style={{ margin: 0 }}>Make sure everyone who was recorded agreed to it before you add their words here.</p>
        <div className="row">
          <span className="grow" style={{ color: 'var(--bad)' }}>{error}</span>
          {saving && <span className="progress"><Spinner />Saving</span>}
          <button type="submit" className="btn primary" disabled={!ok || saving}>{claude ? 'Add and summarize' : 'Add call'}</button>
        </div>
      </form>
    </dialog>
  );
}
