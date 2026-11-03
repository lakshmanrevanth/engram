import { describe, it, expect } from 'vitest';
import { LEARNING_PATHS, getPathArticle, previousArticle, promptsFor } from './paths';

describe('learning paths', () => {
  it('has 7 paths in order with consecutive positions', () => {
    expect(LEARNING_PATHS.map((p) => p.slug)).toEqual([
      'system-design-fundamentals',
      'hld-interview-prep',
      'lld-classics',
      'backend-engineering-fundamentals',
      'distributed-systems',
      'microservices',
      'ai-and-ml-foundations',
    ]);
    for (const p of LEARNING_PATHS) {
      p.articles.forEach((a, i) => expect(a.position).toBe(i + 1));
    }
  });

  it('has unique titles across all paths', () => {
    const titles = LEARNING_PATHS.flatMap((p) => p.articles.map((a) => a.title.toLowerCase()));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('finds the previous article in the same path', () => {
    expect(previousArticle('hld-interview-prep-1')).toBeUndefined();
    expect(previousArticle('hld-interview-prep-2')?.id).toBe('hld-interview-prep-1');
    expect(getPathArticle('nope')).toBeUndefined();
  });

  it('gives design-specific prompts for HLD articles', () => {
    const hld = getPathArticle('hld-interview-prep-2')!.article;
    expect(promptsFor(hld)[0]).toMatch(/requirements/);
  });
});
