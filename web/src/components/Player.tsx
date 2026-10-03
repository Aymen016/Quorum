import { forwardRef, useEffect, useState } from 'react';
import { deleteRecording, getRecording, isMedia, saveRecording } from '../media.ts';

interface Props {
  meetingId: string;
  onTime: (t: number | null) => void;
  say: (msg: string) => void;
}

/** Video/audio player for a call's recording, or a prompt to attach one. */
const Player = forwardRef<HTMLMediaElement, Props>(function Player({ meetingId, onTime, say }, ref) {
  const [rec, setRec] = useState<{ url: string; type: string; name: string } | null | undefined>(undefined);

  useEffect(() => {
    let url = '';
    getRecording(meetingId).then(f => {
      if (!f) { setRec(null); return; }
      url = URL.createObjectURL(f);
      setRec({ url, type: f.type, name: f.name });
    });
    return () => { if (url) URL.revokeObjectURL(url); onTime(null); };
  }, [meetingId, onTime]);

  const attach = async (f?: File) => {
    if (!f) return;
    if (!isMedia(f)) { say('Choose a video or audio file (mp4, webm, mov, mp3, m4a, wav).'); return; }
    if (!(await saveRecording(meetingId, f))) { say('This browser could not store the recording.'); return; }
    if (rec) URL.revokeObjectURL(rec.url);
    setRec({ url: URL.createObjectURL(f), type: f.type, name: f.name });
    say('Recording attached');
  };
  const remove = async () => {
    await deleteRecording(meetingId);
    if (rec) URL.revokeObjectURL(rec.url);
    setRec(null);
    onTime(null);
    say('Recording removed');
  };

  if (rec === undefined) return null;

  const picker = (label: string, primary = false) => (
    <label className={`btn${primary ? ' primary' : ''}`} style={{ cursor: 'pointer' }}>
      {label}
      <input type="file" accept="video/*,audio/*" hidden onChange={e => { attach(e.target.files?.[0]); e.target.value = ''; }} />
    </label>
  );

  if (!rec) {
    return (
      <section className="player-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="2.5" y="5" width="14" height="14" rx="2.5" /><path d="M16.5 10l5-3v10l-5-3z" /></svg>
        <div className="grow" style={{ display: 'grid', gap: 2 }}>
          <b>No recording attached</b>
          <span className="parse-info">Attach the call's video or audio to watch it here, synced to the transcript. It stays in this browser and isn't uploaded.</span>
        </div>
        {picker('Attach recording', true)}
      </section>
    );
  }

  const common = {
    src: rec.url,
    controls: true,
    preload: 'metadata' as const,
    onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => onTime(e.currentTarget.currentTime),
  };
  return (
    <section className="player">
      {rec.type.startsWith('audio/')
        ? <audio ref={ref as React.Ref<HTMLAudioElement>} {...common} />
        : <video ref={ref as React.Ref<HTMLVideoElement>} playsInline {...common} />}
      <div className="player-bar">
        <span className="parse-info" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.name} · stored in this browser</span>
        <span className="grow" />
        {picker('Replace')}
        <button className="btn ghost danger" onClick={remove}>Remove</button>
      </div>
    </section>
  );
});

export default Player;
