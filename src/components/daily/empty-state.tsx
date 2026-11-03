'use client';

import Link from 'next/link';
import { describeUpcoming, type Upcoming } from './all-done';

// isNewUser: the user has no problems yet, so "all caught up" would be misleading.
export function EmptyState({
  isNewUser = false,
  upcoming,
  todayKey,
  ladder = [3, 7, 14, 30],
}: {
  isNewUser?: boolean;
  upcoming?: Upcoming;
  todayKey?: string;
  ladder?: readonly number[];
}) {
  const next = todayKey ? describeUpcoming(upcoming, todayKey) : null;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 0',
        gap: 12,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>
        {isNewUser ? '⌈ Start your revision ladder ⌋' : '⌈ You’re all caught up ⌋'}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, marginTop: 4 }}>
        {isNewUser ? (
          <>
            Add a problem you&apos;ve solved and it shows up here in {ladder[0]} days,
            <br />
            then again after {ladder[1]}, {ladder[2]} and {ladder[3]} days as you keep remembering it.
          </>
        ) : (
          <>
            No problems due today.{next ? ` ${next}.` : ''}
            <br />
            Add new problems from the table any time.
          </>
        )}
      </div>
      <Link
        href="/dashboard"
        style={{
          marginTop: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--icon-btn-bg)',
          border: '1px solid var(--icon-btn-border)',
          borderRadius: 6,
          color: 'var(--icon-btn-color)',
          fontSize: 13,
          padding: '7px 16px',
          textDecoration: 'none',
          transition: 'color 0.15s, border-color 0.15s',
        }}
      >
        Go to problems table →
      </Link>
    </div>
  );
}
