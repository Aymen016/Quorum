import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TALK_BUCKETS, type Alert, type AlertMatch, type Clip, type Deal, type Meeting, type MeetingMeta,
  type MemberStats, type Playlist, type TeamStats,
} from '../src/types.ts';
import { escapeRe, segments } from '../src/util.ts';
import { exampleMeeting, exampleClip, examplePlaylist, exampleAlerts } from './seed.ts';

// Serverless hosts only allow writing to /tmp (and it is wiped on cold starts).
const DATA_DIR = process.env.VERCEL
  ? '/tmp/fathom-data'
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const FILE = path.join(DATA_DIR, 'quorum.json');

interface Db {
  meetings: Record<string, Meeting>;
  clips: Record<string, Clip>;
  playlists: Record<string, Playlist>;
  alerts: Record<string, Alert>;
  deals: Record<string, Deal>;
}

const byId = <T extends { id: string }>(items: T[]) => Object.fromEntries(items.map(i => [i.id, i]));

function load(): Db {
  let db: Partial<Db>;
  try {
    db = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Partial<Db>;
  } catch {
    // First run: start with one clearly labelled example call.
    const m = exampleMeeting();
    db = { meetings: { [m.id]: m }, clips: byId([exampleClip(m.id)]) };
  }
  // Data files from before playlists/alerts/deals existed get those collections added once.
  if (!db.playlists) db.playlists = db.clips?.['example-clip'] ? byId([examplePlaylist(['example-clip'])]) : {};
  if (!db.alerts) db.alerts = byId(exampleAlerts());
  db.deals ??= {};
  return db as Db;
}

const db: Db = load();
let timer: NodeJS.Timeout | null = null;

// Writes are debounced and atomic (write temp file, then rename).
function persist() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
  }, 100);
}
persist();

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function talkMap(m: Meeting) {
  const D = Math.max(1, m.duration);
  const sets = m.speakers.map(() => new Set<number>());
  for (const g of segments(m.lines)) {
    const i = m.speakers.indexOf(g.s);
    if (i < 0) continue;
    const a = Math.floor((g.t / D) * TALK_BUCKETS), b = Math.floor((Math.min(g.end, D - 1) / D) * TALK_BUCKETS);
    for (let k = a; k <= Math.min(b, TALK_BUCKETS - 1); k++) sets[i].add(k);
  }
  return sets.map(s => [...s].sort((x, y) => x - y));
}

/** Per-speaker conversation analytics across every call, computed from the transcripts. */
function teamStats(): TeamStats {
  const meetings = Object.values(db.meetings);
  const acc = new Map<string, { calls: number; talk: number; share: number; mono: number; questions: number; last: number }>();
  for (const m of meetings) {
    const segs = segments(m.lines);
    const total = segs.reduce((s, g) => s + Math.max(1, g.end - g.t), 0) || 1;
    const talk: Record<string, number> = {}, longest: Record<string, number> = {}, qs: Record<string, number> = {};
    // A monologue is a run of consecutive turns by one speaker, until someone else speaks
    // or there is a pause (a gap in the transcript is not continuous talking).
    let runSpeaker = '', runStart = 0, prevEnd = 0;
    segs.forEach((g, i) => {
      talk[g.s] = (talk[g.s] || 0) + Math.max(1, g.end - g.t);
      qs[g.s] = (qs[g.s] || 0) + (m.lines[i].x.match(/\?/g)?.length ?? 0);
      if (g.s !== runSpeaker || g.t - prevEnd > 5) { runSpeaker = g.s; runStart = g.t; }
      prevEnd = g.end;
      longest[g.s] = Math.max(longest[g.s] || 0, g.end - runStart);
    });
    for (const s of m.speakers) {
      const a = acc.get(s) ?? { calls: 0, talk: 0, share: 0, mono: 0, questions: 0, last: 0 };
      a.calls++; a.talk += talk[s] || 0; a.share += (talk[s] || 0) / total; a.mono += longest[s] || 0; a.questions += qs[s] || 0;
      a.last = Math.max(a.last, m.date);
      acc.set(s, a);
    }
  }
  const members: MemberStats[] = [...acc].map(([name, a]) => ({
    name, calls: a.calls, talkSeconds: Math.round(a.talk), talkShare: a.share / a.calls,
    longestMonologue: Math.round(a.mono / a.calls), questionsPerCall: a.questions / a.calls, lastCall: a.last,
  })).sort((x, y) => y.calls - x.calls || y.talkSeconds - x.talkSeconds);
  const week = 7 * 86400000, now = Date.now();
  const callsByWeek = Array.from({ length: 8 }, (_, i) => {
    const end = now - (7 - i) * week, start = end - week;
    return meetings.filter(m => m.date > start && m.date <= end).length;
  });
  return { calls: meetings.length, totalSeconds: meetings.reduce((s, m) => s + m.duration, 0), callsByWeek, members };
}

function alertMatches(): AlertMatch[] {
  const out: AlertMatch[] = [];
  const meetings = Object.values(db.meetings).sort((a, b) => b.date - a.date);
  for (const a of Object.values(db.alerts)) {
    const re = new RegExp(`\\b${escapeRe(a.keyword)}`, 'i');
    for (const m of meetings) for (const l of m.lines) {
      if (re.test(l.x)) out.push({ alertId: a.id, meetingId: m.id, title: m.title, date: m.date, t: l.t, s: l.s, x: l.x });
    }
  }
  return out;
}

export const store = {
  listMeetings: (): MeetingMeta[] => Object.values(db.meetings)
    .map(({ lines, ...meta }) => ({ ...meta, talkMap: talkMap({ ...meta, lines }) }))
    .sort((a, b) => b.date - a.date),
  getMeeting: (id: string) => db.meetings[id],
  putMeeting(m: Meeting) { db.meetings[m.id] = m; persist(); return m; },
  patchMeeting(id: string, patch: Partial<Meeting>) {
    const m = db.meetings[id];
    if (!m) return undefined;
    Object.assign(m, patch);
    persist();
    return m;
  },
  deleteMeeting(id: string) {
    delete db.meetings[id];
    for (const c of Object.values(db.clips)) if (c.meetingId === id) store.deleteClip(c.id);
    for (const d of Object.values(db.deals)) d.meetingIds = d.meetingIds.filter(x => x !== id);
    persist();
  },

  listClips: () => Object.values(db.clips).sort((a, b) => b.createdAt - a.createdAt),
  putClip(c: Clip) { db.clips[c.id] = c; persist(); return c; },
  deleteClip(id: string) {
    delete db.clips[id];
    for (const p of Object.values(db.playlists)) p.clipIds = p.clipIds.filter(x => x !== id);
    persist();
  },

  listPlaylists: () => Object.values(db.playlists).sort((a, b) => b.createdAt - a.createdAt),
  getPlaylist: (id: string) => db.playlists[id],
  putPlaylist(p: Playlist) { db.playlists[p.id] = p; persist(); return p; },
  deletePlaylist(id: string) { delete db.playlists[id]; persist(); },

  listAlerts: () => Object.values(db.alerts).sort((a, b) => a.createdAt - b.createdAt),
  putAlert(a: Alert) { db.alerts[a.id] = a; persist(); return a; },
  deleteAlert(id: string) { delete db.alerts[id]; persist(); },
  alertMatches,

  listDeals: () => Object.values(db.deals).sort((a, b) => b.createdAt - a.createdAt),
  getDeal: (id: string) => db.deals[id],
  putDeal(d: Deal) { db.deals[d.id] = d; persist(); return d; },
  deleteDeal(id: string) { delete db.deals[id]; persist(); },

  teamStats,
};
