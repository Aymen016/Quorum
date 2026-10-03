import { Fragment } from 'react';
import { escapeRe, fmt, initials, toSec } from '../util.ts';

/** Speaker color by their rank in talk time; matches the --s0..--s7 tokens. */
export const speakerColor = (speakers: string[], name: string) => {
  const i = speakers.findIndex(s => s.toLowerCase() === name.toLowerCase());
  return `var(--s${(i < 0 ? 7 : i) % 8})`;
};

export function Highlight({ text, q }: { text: string; q: string }) {
  const terms = q.trim().split(/\s+/).filter(t => t.length > 1).map(escapeRe);
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.join('|')})`, 'gi');
  return <>{text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>))}</>;
}

export function TimeButton({ t, onJump }: { t: number; onJump: (t: number) => void }) {
  return <button className="tbtn" onClick={() => onJump(t)}>{fmt(t)}</button>;
}

/** Renders text with [m:ss] / h:mm:ss timestamps turned into jump buttons. */
export function LinkedTimes({ text, onJump }: { text: string; onJump: (t: number) => void }) {
  const re = /\[?\b((?:\d{1,2}:)?\d{1,2}:\d{2})\b\]?/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    parts.push(text.slice(last, m.index));
    parts.push(<button key={m.index} className="tbtn" onClick={() => onJump(toSec(m[1]))}>{m[1]}</button>);
    last = m.index! + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

export const Spinner = () => <span className="spin" aria-hidden="true" />;

export const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/** Simple waveform mark; deliberately not the real Fathom logo. */
export const Logo = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" fill="currentColor">
    <rect x="2" y="10" width="3.2" height="6" rx="1.6" />
    <rect x="7.4" y="6" width="3.2" height="14" rx="1.6" />
    <rect x="12.8" y="2" width="3.2" height="22" rx="1.6" />
    <rect x="18.2" y="7.5" width="3.2" height="11" rx="1.6" opacity="0.7" />
  </svg>
);

export const SparkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
    <path d="M6 1l1.2 3.6L11 6 7.2 7.3 6 11 4.8 7.3 1 6l3.8-1.4L6 1zm6 7l.7 2 2 .8-2 .7-.7 2-.7-2-2-.7 2-.8.7-2z" />
  </svg>
);

export function Avatars({ names, all, max = 5 }: { names: string[]; all: string[]; max?: number }) {
  const shown = names.slice(0, max);
  return (
    <span className="avatars" title={names.join(', ')}>
      {shown.map(n => <span key={n} className="avatar" style={{ background: speakerColor(all, n) }}>{initials(n)}</span>)}
      {names.length > max && <span className="avatar more">+{names.length - max}</span>}
    </span>
  );
}
