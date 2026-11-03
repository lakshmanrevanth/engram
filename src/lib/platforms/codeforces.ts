import type { PlatformResolver, ResolveResult, ProblemMeta } from './types';
import { codeforcesNumericId } from './problem-input';

let cachedMaps: {
  codeMap: Map<string, ProblemMeta>;
  numMap: Map<number, ProblemMeta>;
} | null = null;

async function getMaps(): Promise<{
  codeMap: Map<string, ProblemMeta>;
  numMap: Map<number, ProblemMeta>;
}> {
  if (!cachedMaps) {
    const problems = (await import('../../data/codeforces-problems.json')).default;
    const codeMap = new Map<string, ProblemMeta>();
    const numMap = new Map<number, ProblemMeta>();

    (problems as any[]).forEach((p) => {
      const meta: ProblemMeta = {
        title: p.title,
        difficulty: p.difficulty,
        topic: p.topic,
        url: p.url,
        problemNumber: codeforcesNumericId(p.id) ?? p.numericId,
        code: p.id,
      };
      codeMap.set(p.id.toUpperCase(), meta);
      if (p.numericId) {
        numMap.set(p.numericId, meta);
      }
    });

    cachedMaps = { codeMap, numMap };
  }
  return cachedMaps;
}

// ── Live fallback: public Codeforces API, cached in memory for an hour ──────
const CF_API = 'https://codeforces.com/api/problemset.problems';
const LIVE_TTL_MS = 60 * 60 * 1000;
const LIVE_TIMEOUT_MS = 6000;

let liveCache: { at: number; map: Map<string, ProblemMeta> } | null = null;
let liveInflight: Promise<Map<string, ProblemMeta>> | null = null;

export function ratingToDifficulty(rating: unknown): ProblemMeta['difficulty'] {
  if (typeof rating !== 'number') return 'MEDIUM';
  if (rating < 1200) return 'EASY';
  if (rating < 1800) return 'MEDIUM';
  return 'HARD';
}

export function buildLiveMap(problems: any[]): Map<string, ProblemMeta> {
  const map = new Map<string, ProblemMeta>();
  for (const p of problems) {
    if (!p || typeof p.contestId !== 'number' || typeof p.index !== 'string' || !p.name) continue;
    const code = `${p.contestId}${p.index}`.toUpperCase();
    map.set(code, {
      title: String(p.name),
      difficulty: ratingToDifficulty(p.rating),
      topic: Array.isArray(p.tags) && p.tags[0] ? String(p.tags[0]) : '',
      url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
      problemNumber: codeforcesNumericId(code) ?? undefined,
      code,
    });
  }
  return map;
}

async function fetchLiveMap(): Promise<Map<string, ProblemMeta>> {
  if (liveCache && Date.now() - liveCache.at < LIVE_TTL_MS) return liveCache.map;
  if (!liveInflight) {
    liveInflight = (async () => {
      const res = await fetch(CF_API, { signal: AbortSignal.timeout(LIVE_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`Codeforces API ${res.status}`);
      const json = await res.json();
      if (json?.status !== 'OK' || !Array.isArray(json?.result?.problems)) {
        throw new Error('Codeforces API returned an unexpected response');
      }
      const map = buildLiveMap(json.result.problems);
      liveCache = { at: Date.now(), map };
      return map;
    })().finally(() => { liveInflight = null; });
  }
  return liveInflight;
}

// Test hook.
export function _resetCodeforcesLiveCache() {
  liveCache = null;
  liveInflight = null;
}

// Accepts "4A", "4a", "1234C2", or a problemset/contest URL.
export function parseCodeforcesIdentifier(identifier: string): string {
  const raw = identifier.trim();
  const m = raw.match(/(?:problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?([A-Za-z]\d*)/);
  if (m) return `${m[1]}${m[2]}`.toUpperCase();
  return raw.toUpperCase();
}

class CodeforcesResolver implements PlatformResolver {
  async resolve(identifier: string): Promise<ResolveResult> {
    const raw = parseCodeforcesIdentifier(identifier);
    if (!raw) return { found: false };

    const { codeMap, numMap } = await getMaps();

    // 1. Direct code lookup (e.g. "4A", "158A")
    let data = codeMap.get(raw);
    if (data) return { found: true, data };

    // 2. Numeric ID lookup (e.g. "401")
    if (/^\d+$/.test(raw)) {
      data = numMap.get(parseInt(raw, 10));
      if (data) return { found: true, data };
    }

    // 3. Live API for codes newer than the bundled dataset
    if (/^\d+[A-Z]\d*$/.test(raw)) {
      try {
        const live = await fetchLiveMap();
        const hit = live.get(raw);
        return hit ? { found: true, data: hit } : { found: false, reason: 'not_found' };
      } catch (e) {
        console.warn('[codeforces] live lookup failed', e);
        return { found: false, reason: 'lookup_failed' };
      }
    }

    return { found: false, reason: 'not_found' };
  }
}

export const codeforcesResolver = new CodeforcesResolver();
