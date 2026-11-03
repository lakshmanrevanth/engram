import { describe, it, expect } from 'vitest';
import { CONCEPTS, CONCEPT_CATEGORIES, getConcept, searchConcepts, buildConceptNotes } from './library';

describe('concept library', () => {
  it('has unique slugs and valid categories', () => {
    const slugs = new Set(CONCEPTS.map((c) => c.slug));
    expect(slugs.size).toBe(CONCEPTS.length);
    for (const c of CONCEPTS) {
      expect(CONCEPT_CATEGORIES as readonly string[]).toContain(c.category);
      expect(c.prompts.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('finds concepts by title prefix first', () => {
    const results = searchConcepts('consistent');
    expect(results[0].slug).toBe('consistent-hashing');
  });

  it('searches categories and summaries', () => {
    expect(searchConcepts('kafka').some((c) => c.slug === 'pub-sub-kafka')).toBe(true);
  });

  it('builds notes with the summary and recall prompts', () => {
    const notes = buildConceptNotes('My notes', getConcept('cap-theorem'));
    expect(notes.startsWith('My notes')).toBe(true);
    expect(notes).toContain('Recall before rating:');
    expect(notes).toContain('1. ');
  });
});
