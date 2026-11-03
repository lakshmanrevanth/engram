'use client';

import { siteConfig } from '@/config/site';
import { CheckCircle2, Hash, SearchX, Upload } from 'lucide-react';

const btn: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--foreground)',
  fontSize: 12.5,
  padding: '7px 14px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const wrap: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 16px', gap: 10, textAlign: 'center',
};

const title: React.CSSProperties = { fontSize: 16, color: 'var(--foreground)', fontWeight: 500 };
const body: React.CSSProperties = { fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.6, maxWidth: 420 };

/** Shown when the user has no problems at all. */
export function FirstRunPanel({ onAdd, onImport, ladder = [3, 7, 14, 30] }: { onAdd: () => void; onImport: () => void; ladder?: readonly number[] }) {
  const card: React.CSSProperties = {
    flex: '1 1 220px', textAlign: 'left', background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 16,
    display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0,
  };
  const cardTitle: React.CSSProperties = { fontSize: 13.5, fontWeight: 600, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 };
  const cardBody: React.CSSProperties = { fontSize: 12.5, color: 'var(--muted-foreground)', lineHeight: 1.55, flex: 1 };
  return (
    <div style={{ padding: '32px 20px' }}>
      <div style={{ ...title, textAlign: 'center', marginBottom: 6 }}>Start your revision list</div>
      <div style={{ ...body, margin: '0 auto 20px', textAlign: 'center' }}>Add the problems you solve and {siteConfig.name} tells you when to review each one.</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', maxWidth: 820, margin: '0 auto' }}>
        <div style={card}>
          <div style={cardTitle}><Hash size={15} aria-hidden /> Add by number or URL</div>
          <div style={cardBody}>Type a LeetCode number like <code>146</code>, or paste a problem link from LeetCode, Codeforces, GFG, HackerRank or CodeChef.</div>
          <button onClick={onAdd} style={{ ...btn, alignSelf: 'flex-start' }}>+ Add a problem</button>
        </div>
        <div style={card}>
          <div style={cardTitle}><Upload size={15} aria-hidden /> Import CSV / Excel</div>
          <div style={cardBody}>Already tracking problems in a spreadsheet? Bring them in with their topics, notes and dates.</div>
          <button onClick={onImport} style={{ ...btn, alignSelf: 'flex-start' }}><Upload size={13} aria-hidden /> Import file</button>
        </div>
        <div style={card}>
          <div style={cardTitle}><CheckCircle2 size={15} aria-hidden /> How reviews work</div>
          <div style={cardBody}>
            Each problem comes back after {ladder.join(' → ')} days. When it&apos;s due, rate how it went:
            <b> Clean</b> moves it up the ladder, <b>Shaky</b> repeats the same gap, <b>Struggled</b> starts it over.
            A clean review at the top marks it mastered, with one recheck after 90 days.
          </div>
        </div>
      </div>
    </div>
  );
}

/** Shown when search or filters hide every row. */
export function NoMatches({ onClear, message = 'No problems match your search and filters.' }: { onClear: () => void; message?: string }) {
  return (
    <div style={wrap}>
      <SearchX size={36} aria-hidden style={{ color: 'var(--text-faint)' }} />
      <div style={title}>No matches</div>
      <div style={body}>{message}</div>
      <button onClick={onClear} style={btn}>Clear filters</button>
    </div>
  );
}

/** Shown on the Due view when nothing is due. */
export function AllCaughtUp({ nextReview }: { nextReview: string | null }) {
  return (
    <div style={wrap}>
      <CheckCircle2 size={36} aria-hidden style={{ color: 'var(--success)' }} />
      <div style={title}>All caught up</div>
      <div style={body}>{nextReview ? `Next review: ${nextReview}.` : 'Nothing is scheduled. Add problems to start a review ladder.'}</div>
    </div>
  );
}

/** Generic empty view (bookmarks, an empty list). */
export function EmptyView({ heading, text }: { heading: string; text: string }) {
  return (
    <div style={wrap}>
      <div style={title}>{heading}</div>
      <div style={body}>{text}</div>
    </div>
  );
}
