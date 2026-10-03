import type { Line } from './types.ts';

export const fmt = (sec: number) => {
  const s0 = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s0 / 3600), m = Math.floor((s0 % 3600) / 60), s = s0 % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};
export const fmtDur = (sec: number) => {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};
export const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const words = (s: string) => (s.match(/\S+/g) || []).length;
export const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const transcriptText = (lines: Line[]) => lines.map(l => `[${fmt(l.t)}] ${l.s}: ${l.x}`).join('\n');
const SPEECH_RATE = 2.6; // words per second, used to estimate turn length

/* ---------- transcript parsing ---------- */
const TS = '(?:\\d{1,2}:)?\\d{1,2}:\\d{2}(?:[.,]\\d{1,3})?';
export const toSec = (s: string) => {
  const p = s.replace(',', '.').split(':').map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
};
const okName = (n?: string) => !!n && n.length <= 40 && n.split(/\s+/).length <= 5 && !/[.?!]$/.test(n) && !/^(https?|note)$/i.test(n);

interface Draft { t: number | null; s: string | null; x: string }

/** Reads Zoom, Meet, Teams, Otter, Fathom exports, "Name: text" lines, and .vtt/.srt captions. */
export function parseTranscript(raw: string) {
  const src = raw.replace(/\r/g, '').replace(/^﻿/, '');
  const out: Draft[] = [];
  if (/-->/.test(src)) {
    let last = 'Speaker';
    for (const b of src.split(/\n\s*\n/)) {
      const ls = b.split('\n').map(l => l.trim()).filter(Boolean);
      const ti = ls.findIndex(l => l.includes('-->'));
      if (ti < 0) continue;
      const tm = ls[ti].match(new RegExp(TS));
      let text = ls.slice(ti + 1).join(' ');
      if (!text) continue;
      let s: string | null = null;
      const v = text.match(/^<v\s+([^>]+)>/i);
      if (v) { s = v[1].trim(); text = text.replace(/^<v\s+[^>]+>/i, ''); }
      text = text.replace(/<[^>]+>/g, '').trim();
      const n = !s ? text.match(/^([^:]{1,40}):\s+(.+)$/) : null;
      if (n && okName(n[1])) { s = n[1].trim(); text = n[2]; }
      s = s || last; last = s;
      const t = tm ? toSec(tm[0]) : null;
      const prev = out[out.length - 1];
      if (prev && prev.s === s && t != null && prev.t != null && t - prev.t < 30 && words(prev.x) < 80) prev.x += ' ' + text;
      else out.push({ t, s, x: text });
    }
  } else {
    const reTimeName = new RegExp(`^\\[?(${TS})\\]?\\s*[-–|]?\\s*([^:\\[\\]]{1,40}?)\\s*:\\s+(.+)$`);
    const reNameTime = new RegExp(`^([^:\\[\\]\\d][^:\\[\\]]{0,39}?)\\s*[-–|]?\\s*[\\(\\[]?(${TS})[\\)\\]]?\\s*[:\\-–]?\\s*(.*)$`);
    const reTimeText = new RegExp(`^\\[?(${TS})\\]?\\s*[-–|]?\\s*(.*)$`);
    const reName = /^([A-Z][^:]{0,39}):\s+(.+)$/;
    const reHeaderName = /^[A-Z][\w'’.-]*(\s+[A-Z][\w'’.-]*){0,3}$/;
    let pending: Draft | null = null;
    const push = (t: number | null, s: string | null, x: string) => {
      const e = { t, s, x: x.trim() };
      out.push(e);
      pending = e.x ? null : e;
    };
    for (let line of src.split('\n')) {
      line = line.trim();
      if (!line) continue;
      let m: RegExpMatchArray | null;
      if ((m = line.match(reTimeName)) && okName(m[2])) { push(toSec(m[1]), m[2].trim(), m[3]); continue; }
      if ((m = line.match(reNameTime)) && okName(m[1])) { push(toSec(m[2]), m[1].trim(), m[3] || ''); continue; }
      if ((m = line.match(reTimeText))) {
        const n = m[2].match(reName);
        if (n && okName(n[1])) { push(toSec(m[1]), n[1].trim(), n[2]); continue; }
        if (!m[2]) { push(toSec(m[1]), null, ''); continue; }
        if (reHeaderName.test(m[2])) { push(toSec(m[1]), m[2], ''); continue; }
        push(toSec(m[1]), out.length ? out[out.length - 1].s : 'Speaker', m[2]);
        continue;
      }
      const p = pending as Draft | null;
      if ((m = line.match(reName)) && okName(m[1])) {
        if (p && !p.s) { p.s = m[1].trim(); p.x = m[2]; pending = null; continue; }
        push(null, m[1].trim(), m[2]);
        continue;
      }
      if (p) {
        if (!p.s && !p.x && okName(line)) { p.s = line; continue; }
        p.x = (p.x + ' ' + line).trim();
        if (p.s) pending = null;
        continue;
      }
      if (out.length) out[out.length - 1].x += ' ' + line;
      else push(null, 'Speaker', line);
    }
  }
  const lines: Line[] = out.filter(l => l.x.trim()).map(l => ({ t: l.t ?? -1, s: l.s || 'Speaker', x: l.x.trim() }));
  // Fill in missing or out-of-order timestamps from speaking rate.
  let clock = 0;
  for (const l of lines) {
    if (l.t < clock) l.t = clock;
    clock = l.t + words(l.x) / SPEECH_RATE;
  }
  for (const l of lines) l.t = Math.round(l.t);
  const talk = talkSeconds(lines);
  const speakers = Object.keys(talk).sort((a, b) => talk[b] - talk[a]);
  const last = lines[lines.length - 1];
  const duration = last ? Math.round(last.t + words(last.x) / SPEECH_RATE) : 0;
  return { lines, speakers, duration };
}

export interface Segment { s: string; t: number; end: number }

export function segments(lines: Line[]): Segment[] {
  return lines.map((l, i) => ({
    s: l.s,
    t: l.t,
    end: i < lines.length - 1
      ? Math.min(lines[i + 1].t, l.t + Math.max(4, words(l.x) / 1.6))
      : l.t + words(l.x) / SPEECH_RATE,
  }));
}

function talkSeconds(lines: Line[]) {
  const tot: Record<string, number> = {};
  for (const g of segments(lines)) tot[g.s] = (tot[g.s] || 0) + Math.max(1, g.end - g.t);
  return tot;
}

export function talkShare(lines: Line[]) {
  const tot = talkSeconds(lines);
  const all = Object.values(tot).reduce((a, b) => a + b, 0) || 1;
  const out: Record<string, number> = {};
  for (const k in tot) out[k] = tot[k] / all;
  return out;
}

export const lineEnd = (l: Line) => Math.round(l.t + words(l.x) / SPEECH_RATE);
