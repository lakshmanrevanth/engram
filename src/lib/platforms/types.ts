// Types shared across all platform resolvers.
// Each platform (LeetCode, Codeforces, etc.) implements PlatformResolver.

export type ProblemMeta = {
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  topic: string;
  url: string;
  problemNumber?: number;
  code?: string;
};

export type ResolveResult =
  | { found: true; data: ProblemMeta }
  // reason: 'lookup_failed' when a live source was unreachable (vs a plain miss).
  | { found: false; reason?: 'not_found' | 'lookup_failed' };

export interface PlatformResolver {
  resolve(identifier: string): Promise<ResolveResult>;
}
