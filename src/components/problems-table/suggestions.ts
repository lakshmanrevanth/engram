'use client';

// Topic / tag suggestions derived from the user's own problems, read from the
// SWR cache that the table already populates (no extra request).

import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';

const CACHE_ONLY = {
  revalidateOnMount: false,
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
} as const;

export function useCachedProblems(): any[] {
  const { data } = useSWR<any[]>('/api/problems', fetcher, CACHE_ONLY);
  return Array.isArray(data) ? data : [];
}

// Distinct values, most used first, keeping the user's most common spelling.
export function rankedDistinct(values: Iterable<string>): string[] {
  const counts = new Map<string, { label: string; n: number; spellings: Map<string, number> }>();
  for (const raw of values) {
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (!v) continue;
    const key = v.toLowerCase();
    const entry = counts.get(key) ?? { label: v, n: 0, spellings: new Map() };
    entry.n++;
    entry.spellings.set(v, (entry.spellings.get(v) ?? 0) + 1);
    counts.set(key, entry);
  }
  return [...counts.values()]
    .map((e) => ({ n: e.n, label: [...e.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
    .map((e) => e.label);
}

// User values first, then defaults not already covered (case-insensitive).
export function mergeSuggestions(user: string[], defaults: readonly string[]): string[] {
  const seen = new Set(user.map((t) => t.toLowerCase()));
  return [...user, ...defaults.filter((t) => !seen.has(t.toLowerCase()))];
}

export function topicsFrom(problems: any[]): string[] {
  return rankedDistinct(problems.map((p) => p?.topic));
}

export function tagsFrom(problems: any[]): string[] {
  return rankedDistinct(problems.flatMap((p) => (Array.isArray(p?.tags) ? p.tags : [])));
}
