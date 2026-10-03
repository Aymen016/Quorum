import { useEffect, useState } from 'react';
import { Logo, SearchIcon } from './bits.tsx';

export type Page = 'calls' | 'team' | 'playlists' | 'alerts' | 'deals' | 'actions';

interface Props {
  page: Page;
  q: string;
  onQ: (q: string) => void;
  onNav: (p: Page) => void;
  onNew: () => void;
  claude: boolean;
  provider: string;
  counts: Partial<Record<Page, number>>;
}

const TABS: [Page, string][] = [['calls', 'My Calls'], ['team', 'Team Calls'], ['playlists', 'Playlists'], ['alerts', 'Alerts'], ['deals', 'Deals'], ['actions', 'Action Items']];

export default function TopBar({ page, q, onQ, onNav, onNew, claude, provider, counts }: Props) {
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    const id = setTimeout(() => { if (draft !== q) onQ(draft); }, 180);
    return () => clearTimeout(id);
  }, [draft, q, onQ]);

  return (
    <>
      <header className="topbar">
        <button className="brand" onClick={() => onNav('calls')} aria-label="Fathom home">
          <Logo /><span className="brand-word">FATHOM</span>
        </button>
        <div className="topsearch">
          <SearchIcon />
          <input id="q" type="search" placeholder="Search call recordings" autoComplete="off" value={draft} onChange={e => setDraft(e.target.value)} />
        </div>
        <div className="top-actions">
          <span className={`status-chip${claude ? ' on' : ''}`} title={claude ? `AI: ${provider}` : 'Add GROQ_API_KEY or ANTHROPIC_API_KEY to web/.env'}>
            <span className="led" /><span>{claude ? provider : 'AI off'}</span>
          </span>
          <button className="btn primary" onClick={onNew}>
            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
            Add call
          </button>
        </div>
      </header>
      <nav className="tabsbar" aria-label="Sections">
        {TABS.map(([k, label]) => (
          <button key={k} className={`navtab${page === k ? ' on' : ''}`} onClick={() => onNav(k)} aria-current={page === k ? 'page' : undefined}>
            {label}{(counts[k] ?? 0) > 0 && <span className="count">{counts[k]}</span>}
          </button>
        ))}
      </nav>
    </>
  );
}
