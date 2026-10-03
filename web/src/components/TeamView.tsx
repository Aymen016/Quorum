import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.ts';
import type { MeetingMeta, MemberStats, TeamStats } from '../types.ts';
import { fmt, fmtDur, initials } from '../util.ts';
import { CallCard } from './CallsList.tsx';

type SortKey = 'name' | 'calls' | 'talkSeconds' | 'talkShare' | 'longestMonologue' | 'questionsPerCall' | 'lastCall';
const COLS: [SortKey, string, boolean][] = [
  ['name', 'Name', false], ['calls', 'Recent calls', true], ['talkSeconds', 'Talk time', true], ['talkShare', 'Talk share', true],
  ['longestMonologue', 'Longest monologue', true], ['questionsPerCall', 'Questions / call', true], ['lastCall', 'Last call', true],
];
// Coaching thresholds: people who dominate airtime or rarely ask questions.
const TALK_FLAG = 0.45, MONO_FLAG = 150, QUESTION_FLAG = 1;

export default function TeamView({ meetings, version, onOpen }: { meetings: MeetingMeta[]; version: number; onOpen: (id: string) => void }) {
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'calls', desc: true });
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => { api.team().then(setStats).catch(e => setError((e as Error).message)); }, [version]);

  const members = useMemo(() => {
    if (!stats) return [];
    const dir = sort.desc ? -1 : 1;
    return [...stats.members].sort((a, b) => (sort.key === 'name' ? a.name.localeCompare(b.name) * dir : ((a[sort.key] as number) - (b[sort.key] as number)) * dir));
  }, [stats, sort]);

  if (error) return <div className="note">{error}</div>;
  if (!stats) return <div className="progress"><span className="spin" />Crunching the numbers</div>;
  if (!stats.calls) return <div className="empty"><h2>No team calls yet</h2><p>Add calls and everyone who speaks in them shows up here with talk time, monologues and questions.</p></div>;

  const avgShare = stats.members.length ? stats.members.reduce((s, m) => s + m.talkShare, 0) / stats.members.length : 0;
  const maxWeek = Math.max(1, ...stats.callsByWeek);
  const calls = picked ? meetings.filter(m => m.speakers.includes(picked)) : meetings;

  return (
    <>
      <div className="list-head">
        <div style={{ display: 'grid', gap: 4 }}>
          <h1>Team Calls</h1>
          <span className="parse-info">Conversation analytics for everyone who speaks in your calls, worked out from the transcripts.</span>
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <span className="label">Recent calls</span>
          <span className="value">{stats.calls}
            <span className="spark" title="Calls per week, last 8 weeks">{stats.callsByWeek.map((n, i) => <i key={i} style={{ height: `${Math.max(8, (n / maxWeek) * 100)}%`, opacity: n ? 0.9 : 0.25 }} />)}</span>
          </span>
        </div>
        <div className="tile"><span className="label">Time recorded</span><span className="value">{fmtDur(stats.totalSeconds)}</span></div>
        <div className="tile"><span className="label">Team members</span><span className="value">{stats.members.length}</span></div>
        <div className="tile"><span className="label">Average talk share</span><span className="value">{Math.round(avgShare * 100)}%<Ring share={avgShare} /></span></div>
      </div>

      <section className="sec">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>Team members <span className="pill">{stats.members.length}</span></h3>
          <span className="legend">
            <span><span className="flag">●</span> Coaching flag: talk share over {TALK_FLAG * 100}%, monologue over {fmt(MONO_FLAG)}, or under {QUESTION_FLAG} question per call</span>
          </span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>{COLS.map(([k, label, num]) => (
                <th key={k} className={num ? 'num' : ''}>
                  <button className={sort.key === k ? 'on' : ''} onClick={() => setSort(s => ({ key: k, desc: s.key === k ? !s.desc : k !== 'name' }))}>
                    {label}{sort.key === k ? (sort.desc ? ' ↓' : ' ↑') : ''}
                  </button>
                </th>
              ))}</tr>
            </thead>
            <tbody>
              {members.map((m, i) => <MemberRow key={m.name} m={m} color={`var(--s${i % 8})`} on={picked === m.name} onClick={() => setPicked(picked === m.name ? null : m.name)} />)}
            </tbody>
          </table>
        </div>
        <span className="parse-info">Click a person to see only the calls they were in.</span>
      </section>

      <section className="group">
        <h2 className="group-title">{picked ? `Calls with ${picked}` : 'All team calls'} · {calls.length}</h2>
        {calls.map(m => <CallCard key={m.id} m={m} onOpen={onOpen} />)}
      </section>
    </>
  );
}

function MemberRow({ m, color, on, onClick }: { m: MemberStats; color: string; on: boolean; onClick: () => void }) {
  return (
    <tr className={on ? 'on' : ''} onClick={onClick}>
      <td><span className="member"><span className="avatar" style={{ background: color }}>{initials(m.name)}</span>{m.name}</span></td>
      <td className="num">{m.calls}</td>
      <td className="num">{fmtDur(m.talkSeconds)}</td>
      <td className="num"><span className={m.talkShare > TALK_FLAG ? 'flag' : ''}>{Math.round(m.talkShare * 100)}%</span></td>
      <td className="num"><span className={m.longestMonologue > MONO_FLAG ? 'flag' : ''}>{fmt(m.longestMonologue)}</span></td>
      <td className="num"><span className={m.questionsPerCall < QUESTION_FLAG ? 'flag' : ''}>{m.questionsPerCall.toFixed(1)}</span></td>
      <td className="num">{new Date(m.lastCall).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
    </tr>
  );
}

const Ring = ({ share }: { share: number }) => (
  <span className="ring" aria-hidden="true" style={{ background: `conic-gradient(var(--good) ${share * 360}deg, var(--surface-3) 0)`, WebkitMask: 'radial-gradient(circle, transparent 6px, #000 7px)', mask: 'radial-gradient(circle, transparent 6px, #000 7px)' }} />
);
