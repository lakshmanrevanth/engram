import { expect, type APIRequestContext } from '@playwright/test';

/** "YYYY-MM-DD" in the local timezone (the browser runs on the same machine). */
export function localDateKey(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Deletes every problem/concept the signed-in e2e user has, so a spec (or its retry)
 * starts from an empty account regardless of what ran before it.
 */
export async function clearUserData(request: APIRequestContext) {
  const res = await request.get('/api/problems');
  expect(res.ok(), `GET /api/problems -> ${res.status()}`).toBeTruthy();
  const problems = (await res.json()) as { id: string }[];
  for (const p of problems) {
    const del = await request.delete(`/api/problems/${p.id}`);
    expect(del.ok(), `DELETE /api/problems/${p.id} -> ${del.status()}`).toBeTruthy();
  }
}
