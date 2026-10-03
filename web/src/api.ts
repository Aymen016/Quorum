import type { ActionItem, Alert, AlertMatch, ChatTurn, Clip, Deal, Line, Meeting, MeetingMeta, Playlist, TeamStats } from './types.ts';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  status: () => req<{ claude: boolean; provider: string }>('/api/status'),
  meetings: () => req<MeetingMeta[]>('/api/meetings'),
  meeting: (id: string) => req<Meeting>(`/api/meetings/${id}`),
  create: (m: { title: string; date: number; lines: Line[]; speakers: string[]; duration: number }) =>
    req<MeetingMeta>('/api/meetings', { method: 'POST', body: JSON.stringify(m) }),
  summarize: (id: string) => req<void>(`/api/meetings/${id}/summarize`, { method: 'POST' }),
  setDone: (id: string, i: number, done: boolean) =>
    req<ActionItem>(`/api/meetings/${id}/actions/${i}`, { method: 'PATCH', body: JSON.stringify({ done }) }),
  remove: (id: string) => req<void>(`/api/meetings/${id}`, { method: 'DELETE' }),
  clips: () => req<Clip[]>('/api/clips'),
  createClip: (c: Omit<Clip, 'id' | 'createdAt'>) => req<Clip>('/api/clips', { method: 'POST', body: JSON.stringify(c) }),
  removeClip: (id: string) => req<void>(`/api/clips/${id}`, { method: 'DELETE' }),

  playlists: () => req<Playlist[]>('/api/playlists'),
  createPlaylist: (name: string, description = '') => req<Playlist>('/api/playlists', { method: 'POST', body: JSON.stringify({ name, description }) }),
  updatePlaylist: (id: string, patch: Partial<Pick<Playlist, 'name' | 'description' | 'clipIds'>>) =>
    req<Playlist>(`/api/playlists/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removePlaylist: (id: string) => req<void>(`/api/playlists/${id}`, { method: 'DELETE' }),

  alerts: () => req<{ alerts: Alert[]; matches: AlertMatch[] }>('/api/alerts'),
  createAlert: (keyword: string) => req<Alert>('/api/alerts', { method: 'POST', body: JSON.stringify({ keyword }) }),
  removeAlert: (id: string) => req<void>(`/api/alerts/${id}`, { method: 'DELETE' }),

  deals: () => req<Deal[]>('/api/deals'),
  createDeal: (d: Pick<Deal, 'name' | 'company' | 'stage' | 'value' | 'meetingIds'>) => req<Deal>('/api/deals', { method: 'POST', body: JSON.stringify(d) }),
  updateDeal: (id: string, patch: Partial<Omit<Deal, 'id' | 'createdAt'>>) => req<Deal>(`/api/deals/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removeDeal: (id: string) => req<void>(`/api/deals/${id}`, { method: 'DELETE' }),

  team: () => req<TeamStats>('/api/team'),

  /** Streams Claude's answer; onText receives the whole answer so far. */
  async ask(meetingId: string | null, turns: ChatTurn[], onText: (text: string) => void, signal: AbortSignal) {
    const res = await fetch('/api/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meetingId, turns }), signal,
    });
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let text = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += value;
      onText(text);
    }
    return text;
  },
};
