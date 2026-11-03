// Shared validation for /api/lists and /api/problems/bulk.

export const MAX_LIST_NAME = 60;
export const MAX_LISTS = 100;
export const MAX_BULK_IDS = 2000;

export function parseListName(input: unknown): { name: string } | { error: string } {
  if (typeof input !== 'string') return { error: 'name is required' };
  const name = input.trim().replace(/\s+/g, ' ');
  if (!name) return { error: 'name is required' };
  if (name.length > MAX_LIST_NAME) return { error: `name must be at most ${MAX_LIST_NAME} characters` };
  return { name };
}

export function parseIds(input: unknown): { ids: string[] } | { error: string } {
  if (!Array.isArray(input) || input.length === 0) return { error: 'ids must be a non-empty array' };
  if (input.length > MAX_BULK_IDS) return { error: `at most ${MAX_BULK_IDS} ids per request` };
  if (!input.every((v) => typeof v === 'string' && v.length > 0 && v.length < 100)) return { error: 'ids must be strings' };
  return { ids: [...new Set(input as string[])] };
}

/** Prisma unique-constraint violation. */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
}
