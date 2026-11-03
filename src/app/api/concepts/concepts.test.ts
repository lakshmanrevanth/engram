import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/preferences', () => ({
  getUserPreferences: vi.fn().mockResolvedValue({ ladderDays: [3, 7, 14, 30] }),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    problem: {
      findFirst: vi.fn(),
      create: vi.fn((args: { data: unknown }) => args.data),
    },
  },
}));

const post = (body: unknown) =>
  POST(
    new NextRequest('http://localhost/api/concepts', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { cookie: 'tz=UTC' },
    })
  );

describe('POST /api/concepts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth as unknown as () => Promise<unknown>).mockResolvedValue({ user: { id: 'u1' } });
    vi.mocked(prisma.problem.findFirst).mockResolvedValue(null);
  });

  it('creates a library concept due 3 days after today', async () => {
    const res = await post({ slug: 'consistent-hashing', notes: 'ring + vnodes' });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.platform).toBe('SYSTEM_DESIGN');
    expect(data.title).toBe('Consistent hashing');
    expect(data.topic).toBe('Storage');
    expect(data.notes).toContain('ring + vnodes');
    expect(data.notes).toContain('Recall before rating:');
    const days = (new Date(data.nextRevisionAt).getTime() - Date.now()) / 86400000;
    expect(Math.round(days)).toBe(3);
  });

  it('makes a concept learned long ago due today', async () => {
    const res = await post({ title: 'Bloom filters', category: 'Storage', learnedOn: '2026-01-01' });
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(new Date(data.nextRevisionAt).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('rejects future dates, unknown categories and duplicates', async () => {
    expect((await post({ title: 'X', category: 'Storage', learnedOn: '2999-01-01' })).status).toBe(400);
    expect((await post({ title: 'X', category: 'Nope' })).status).toBe(400);
    vi.mocked(prisma.problem.findFirst).mockResolvedValueOnce({ id: 'p9' } as never);
    const dup = await post({ slug: 'cap-theorem' });
    expect(dup.status).toBe(409);
    expect((await dup.json()).existingId).toBe('p9');
  });
});

describe('POST /api/concepts with learning paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth as unknown as () => Promise<unknown>).mockResolvedValue({ user: { id: 'u1' } });
  });

  // findFirst answers "done" only for the codes listed in `learned`.
  const withLearned = (learned: string[]) =>
    vi.mocked(prisma.problem.findFirst).mockImplementation((async (args: { where?: { code?: string } }) =>
      args?.where?.code && learned.includes(args.where.code) ? { id: 'x' } : null) as never);

  it('learns the first article of a path', async () => {
    withLearned([]);
    const res = await post({ pathArticleId: 'system-design-fundamentals-1' });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.code).toBe('path:system-design-fundamentals-1');
    expect(data.topic).toBe('System Design Fundamentals');
    expect(data.url).toMatch(/^https:\/\//);
    expect(data.tags).toContain('system-design-fundamentals');
    expect(data.notes).toContain('Recall before rating:');
  });

  it('refuses to skip ahead in a path', async () => {
    withLearned([]);
    const res = await post({ pathArticleId: 'system-design-fundamentals-3' });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('PATH_ORDER');
  });

  it('allows the next article once the previous one is learned', async () => {
    withLearned(['path:system-design-fundamentals-2']);
    const res = await post({ pathArticleId: 'system-design-fundamentals-3' });
    expect(res.status).toBe(201);
    expect((await res.json()).title).toBe('Design a Content Delivery Network');
  });

  it('rejects an article that is already learned', async () => {
    withLearned(['path:lld-classics-1']);
    expect((await post({ pathArticleId: 'lld-classics-1' })).status).toBe(409);
  });
});

describe('POST /api/concepts double submit', () => {
  it('returns 409 when the database rejects a duplicate code', async () => {
    vi.mocked(auth as unknown as () => Promise<unknown>).mockResolvedValue({ user: { id: 'u1' } });
    vi.mocked(prisma.problem.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.problem.create).mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target: ['userId', 'platform', 'code'] } })
    );
    const res = await post({ pathArticleId: 'system-design-fundamentals-1' });
    expect(res.status).toBe(409);
  });
});
