import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { ChatTurn, Line, Meeting } from '../src/types.ts';
import { store, newId } from './store.ts';
import { ask, aiEnabled, describeError, NO_KEY, providerLabel, summarize } from './ai.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.resolve(here, '..', '.env')); } catch { /* no .env file */ }

const app = express();
app.use(express.json({ limit: '25mb' }));

const running = new Set<string>();

async function runSummary(id: string) {
  const m = store.getMeeting(id);
  if (!m || running.has(id)) return;
  if (!aiEnabled()) { store.patchMeeting(id, { status: 'nosummary', statusText: '' }); return; }
  running.add(id);
  store.patchMeeting(id, { status: 'summarizing', statusText: 'Reading the transcript' });
  try {
    const summary = await summarize(m, statusText => store.patchMeeting(id, { statusText }));
    store.patchMeeting(id, { summary, status: 'ready', statusText: '' });
  } catch (err) {
    console.error(`[summarize ${id}]`, err);
    store.patchMeeting(id, { status: 'failed', statusText: describeError(err) });
  } finally {
    running.delete(id);
  }
}

// A summary that was in flight when the server stopped will never finish; mark it for retry.
for (const m of store.listMeetings()) {
  if (m.status === 'summarizing') store.patchMeeting(m.id, { status: 'failed', statusText: 'The server restarted before the minutes finished. Try again.' });
}

app.get('/api/status', (_req, res) => { res.json({ claude: aiEnabled(), provider: providerLabel() }); });

app.get('/api/meetings', (_req, res) => { res.json(store.listMeetings()); });

app.get('/api/meetings/:id', (req, res) => {
  const m = store.getMeeting(req.params.id);
  if (!m) return void res.status(404).json({ error: 'Meeting not found' });
  res.json(m);
});

app.post('/api/meetings', (req, res) => {
  const { title, date, lines, speakers, duration } = req.body as { title: string; date: number; lines: Line[]; speakers: string[]; duration: number };
  if (!Array.isArray(lines) || lines.length < 2) return void res.status(400).json({ error: 'A meeting needs at least two transcript turns.' });
  const m: Meeting = {
    id: newId(),
    title: String(title || 'Untitled meeting').slice(0, 200),
    date: Number(date) || Date.now(),
    duration: Number(duration) || 0,
    speakers: speakers.map(String),
    lines: lines.map(l => ({ t: Number(l.t) || 0, s: String(l.s), x: String(l.x) })),
    lineCount: lines.length,
    status: aiEnabled() ? 'summarizing' : 'nosummary',
    statusText: '',
    summary: null,
    createdAt: Date.now(),
  };
  store.putMeeting(m);
  void runSummary(m.id);
  const { lines: _l, ...meta } = m;
  res.status(201).json(meta);
});

app.post('/api/meetings/:id/summarize', (req, res) => {
  if (!store.getMeeting(req.params.id)) return void res.status(404).json({ error: 'Meeting not found' });
  if (!aiEnabled()) return void res.status(503).json({ error: NO_KEY });
  void runSummary(req.params.id);
  res.status(202).json({ ok: true });
});

app.patch('/api/meetings/:id/actions/:index', (req, res) => {
  const m = store.getMeeting(req.params.id);
  const i = Number(req.params.index);
  if (!m?.summary?.actions[i]) return void res.status(404).json({ error: 'Action item not found' });
  m.summary.actions[i].done = Boolean(req.body.done);
  store.patchMeeting(m.id, { summary: m.summary });
  res.json(m.summary.actions[i]);
});

app.delete('/api/meetings/:id', (req, res) => {
  store.deleteMeeting(req.params.id);
  res.status(204).end();
});

// Streams the answer as plain text chunks. With a meetingId it answers about that call, otherwise about every call.
app.post('/api/ask', async (req, res) => {
  const meetingId = req.body.meetingId as string | undefined;
  const m = meetingId ? store.getMeeting(meetingId) : undefined;
  if (meetingId && !m) return void res.status(404).json({ error: 'Call not found' });
  if (!aiEnabled()) return void res.status(503).json({ error: NO_KEY });
  const library = store.listMeetings().map(x => store.getMeeting(x.id)!);
  if (!m && !library.length) return void res.status(400).json({ error: 'Add a call first.' });
  const turns = (req.body.turns as ChatTurn[]).filter(t => t.content?.trim());
  const ctrl = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ctrl.abort(); });
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  try {
    await ask(m ? { meeting: m } : { library }, turns, d => res.write(d), ctrl.signal);
  } catch (err) {
    if (!ctrl.signal.aborted) { console.error(`[ask ${meetingId ?? 'all'}]`, err); res.write(`\n\n${describeError(err)}`); }
  }
  res.end();
});

app.get('/api/clips', (_req, res) => { res.json(store.listClips()); });

app.post('/api/clips', (req, res) => {
  const { meetingId, start, end, title } = req.body;
  if (!store.getMeeting(meetingId)) return void res.status(404).json({ error: 'Meeting not found' });
  res.status(201).json(store.putClip({ id: newId(), meetingId, start: Number(start), end: Number(end), title: String(title || 'Untitled clip').slice(0, 200), createdAt: Date.now() }));
});

app.delete('/api/clips/:id', (req, res) => {
  store.deleteClip(req.params.id);
  res.status(204).end();
});

/* ---------- playlists ---------- */
app.get('/api/playlists', (_req, res) => { res.json(store.listPlaylists()); });
app.post('/api/playlists', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return void res.status(400).json({ error: 'Give the playlist a name.' });
  res.status(201).json(store.putPlaylist({ id: newId(), name: name.slice(0, 120), description: String(req.body.description || '').slice(0, 500), clipIds: [], createdAt: Date.now() }));
});
app.patch('/api/playlists/:id', (req, res) => {
  const p = store.getPlaylist(req.params.id);
  if (!p) return void res.status(404).json({ error: 'Playlist not found' });
  const { name, description, clipIds } = req.body;
  if (typeof name === 'string' && name.trim()) p.name = name.trim().slice(0, 120);
  if (typeof description === 'string') p.description = description.slice(0, 500);
  if (Array.isArray(clipIds)) p.clipIds = [...new Set(clipIds.map(String))].filter(id => store.listClips().some(c => c.id === id));
  res.json(store.putPlaylist(p));
});
app.delete('/api/playlists/:id', (req, res) => { store.deletePlaylist(req.params.id); res.status(204).end(); });

/* ---------- alerts ---------- */
app.get('/api/alerts', (_req, res) => { res.json({ alerts: store.listAlerts(), matches: store.alertMatches() }); });
app.post('/api/alerts', (req, res) => {
  const keyword = String(req.body.keyword || '').trim();
  if (keyword.length < 2) return void res.status(400).json({ error: 'Use a keyword of at least 2 characters.' });
  if (store.listAlerts().some(a => a.keyword.toLowerCase() === keyword.toLowerCase())) return void res.status(409).json({ error: `You already track "${keyword}".` });
  res.status(201).json(store.putAlert({ id: newId(), keyword: keyword.slice(0, 60), createdAt: Date.now() }));
});
app.delete('/api/alerts/:id', (req, res) => { store.deleteAlert(req.params.id); res.status(204).end(); });

/* ---------- deals ---------- */
const STAGES = ['Discovery', 'Demo', 'Proposal', 'Negotiation', 'Won', 'Lost'];
app.get('/api/deals', (_req, res) => { res.json(store.listDeals()); });
app.post('/api/deals', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return void res.status(400).json({ error: 'Give the deal a name.' });
  res.status(201).json(store.putDeal({
    id: newId(), name: name.slice(0, 120), company: String(req.body.company || '').slice(0, 120),
    stage: STAGES.includes(req.body.stage) ? req.body.stage : 'Discovery', value: Math.max(0, Number(req.body.value) || 0),
    meetingIds: (Array.isArray(req.body.meetingIds) ? req.body.meetingIds : []).filter((id: string) => store.getMeeting(id)),
    createdAt: Date.now(),
  }));
});
app.patch('/api/deals/:id', (req, res) => {
  const d = store.getDeal(req.params.id);
  if (!d) return void res.status(404).json({ error: 'Deal not found' });
  const { name, company, stage, value, meetingIds } = req.body;
  if (typeof name === 'string' && name.trim()) d.name = name.trim().slice(0, 120);
  if (typeof company === 'string') d.company = company.slice(0, 120);
  if (STAGES.includes(stage)) d.stage = stage;
  if (value != null) d.value = Math.max(0, Number(value) || 0);
  if (Array.isArray(meetingIds)) d.meetingIds = [...new Set(meetingIds.map(String))].filter(id => store.getMeeting(id));
  res.json(store.putDeal(d));
});
app.delete('/api/deals/:id', (req, res) => { store.deleteDeal(req.params.id); res.status(204).end(); });

/* ---------- team analytics ---------- */
app.get('/api/team', (_req, res) => { res.json(store.teamStats()); });

// In production (npm run build && npm start) the API also serves the built React app.
const dist = path.resolve(here, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = Number(process.env.PORT) || 8787;
app.listen(PORT, () => {
  console.log(`Fathom API on http://localhost:${PORT}  (${aiEnabled() ? 'AI: ' + providerLabel() : 'AI off: ' + NO_KEY})`);
});
