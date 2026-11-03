// Client-side problem lookup for the add-problem row. Distinguishes "not found"
// (offer manual entry) from "lookup failed" (network / source down — offer retry).

import { isHttpUrl } from '@/lib/platforms/problem-input';

export type LookupData = {
  title: string;
  difficulty: string;
  topic: string;
  url: string;
  problemNumber?: number;
  code?: string;
};

export type LookupResult =
  | { status: 'found'; data: LookupData }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const NETWORK_MESSAGE = "Couldn't reach the lookup service. Check your connection and retry, or enter details manually.";

function clean(data: any): LookupData {
  return {
    title: String(data.title ?? ''),
    difficulty: String(data.difficulty ?? '').toUpperCase(),
    topic: data.topic && data.topic !== 'General' ? String(data.topic) : '',
    url: String(data.url ?? ''),
    problemNumber: typeof data.problemNumber === 'number' && data.problemNumber > 0 ? data.problemNumber : undefined,
    code: data.code ? String(data.code) : undefined,
  };
}

async function leetcodeLive(body: { titleSlug?: string; query?: string }, fetchImpl: FetchLike): Promise<LookupResult> {
  const res = await fetchImpl('/api/leetcode/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 404) return { status: 'not_found' };
  if (!res.ok) return { status: 'error', message: NETWORK_MESSAGE };
  const json = await res.json();
  return json?.title ? { status: 'found', data: clean(json) } : { status: 'not_found' };
}

async function resolveLocal(platform: string, id: string, fetchImpl: FetchLike): Promise<LookupResult> {
  const res = await fetchImpl(`/api/resolve/${platform.toLowerCase()}?id=${encodeURIComponent(id)}`);
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON error page */ }
  if (json?.found) return { status: 'found', data: clean(json.data) };
  if (!res.ok || json?.reason === 'lookup_failed') return { status: 'error', message: NETWORK_MESSAGE };
  return { status: 'not_found' };
}

export async function lookupProblem(platform: string, rawQuery: string, fetchImpl: FetchLike = fetch): Promise<LookupResult> {
  const query = rawQuery.trim();
  if (!query) return { status: 'not_found' };
  try {
    if (platform === 'LEETCODE') {
      const slug = query.match(/leetcode\.(?:com|cn)\/problems\/([^/?#]+)/)?.[1];
      if (slug) return await leetcodeLive({ titleSlug: slug }, fetchImpl);
      if (isHttpUrl(query)) return { status: 'not_found' };
      const local = await resolveLocal(platform, query, fetchImpl);
      if (local.status !== 'not_found') return local;
      // Newer than the bundled dataset: ask LeetCode directly.
      return await leetcodeLive({ query }, fetchImpl);
    }
    return await resolveLocal(platform, query, fetchImpl);
  } catch {
    return { status: 'error', message: NETWORK_MESSAGE };
  }
}

// What we can carry over from the lookup query into a manual draft.
export function manualPrefill(platform: string, rawQuery: string): { url: string; code?: string; problemNumber?: number } {
  const query = rawQuery.trim();
  if (isHttpUrl(query)) return { url: query };
  if (platform === 'LEETCODE' && /^\d+$/.test(query)) return { url: '', problemNumber: parseInt(query, 10) };
  if (query && !/\s/.test(query) && query.length <= 40) return { url: '', code: query.toUpperCase() };
  return { url: '' };
}

// Finds an already-tracked problem matching a draft (by number, code or URL).
export function findDuplicate(
  problems: any[] | null | undefined,
  platform: string,
  draft: { problemNumber?: number; code?: string; url?: string }
): { id: string; title: string } | null {
  if (!Array.isArray(problems)) return null;
  const url = draft.url?.replace(/\/+$/, '').toLowerCase();
  const code = draft.code?.toUpperCase();
  const hit = problems.find((p) => {
    if (p?.platform !== platform) return false;
    if (draft.problemNumber && p.problemNumber === draft.problemNumber) return true;
    if (code && typeof p.code === 'string' && p.code.toUpperCase() === code) return true;
    if (url && typeof p.url === 'string' && p.url.replace(/\/+$/, '').toLowerCase() === url) return true;
    return false;
  });
  return hit ? { id: hit.id, title: hit.title } : null;
}
