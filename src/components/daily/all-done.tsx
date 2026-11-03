'use client';

import { motion } from 'motion/react';

export type Upcoming = { date: string; count: number } | null | undefined;

/** "Next: 4 problems tomorrow" / "Next: 1 problem on Friday, Nov 7". `todayKey` is the local YYYY-MM-DD. */
export function describeUpcoming(upcoming: Upcoming, todayKey: string): string | null {
  if (!upcoming || upcoming.count <= 0) return null;
  const n = `${upcoming.count} ${upcoming.count === 1 ? 'problem' : 'problems'}`;
  const [y, m, d] = todayKey.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  if (upcoming.date <= todayKey) return `Next: ${n} today`;
  if (upcoming.date === tomorrow) return `Next: ${n} tomorrow`;
  const [uy, um, ud] = upcoming.date.split('-').map(Number);
  const label = new Date(Date.UTC(uy, um - 1, ud)).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `Next: ${n} on ${label}`;
}

type AllDoneProps = {
  streak: number;
  upcoming?: Upcoming;
  todayKey: string;
  goalMet?: boolean;
  goalBasedStreak?: boolean;
};

export function AllDone({ streak, upcoming, todayKey, goalMet = true, goalBasedStreak = false }: AllDoneProps) {
  const next = describeUpcoming(upcoming, todayKey);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 16px',
        gap: 14,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 48, color: '#4ade80', lineHeight: 1 }}>✓</div>

      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--foreground)', marginTop: 4 }}>All done for today</div>

      <div style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6 }}>
        {next ?? 'Nothing else is scheduled yet. Add problems from the table.'}
        {goalBasedStreak && !goalMet && (
          <>
            <br />
            Your streak counts days you reach your daily goal, so today doesn&apos;t count yet.
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 18 }}>🔥</span>
        <span style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
          {streak}
        </span>
        <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>day streak</span>
      </div>
    </motion.div>
  );
}
