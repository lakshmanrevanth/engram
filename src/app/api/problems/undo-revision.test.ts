import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as undoRevisionHandler } from './[id]/undo-revision/route';
import { PATCH as reviseHandler } from './[id]/revise/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    problem: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    revision: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    streakLog: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => {
      // updateMany (optimistic lock) remembers the data so findUnique can return it.
      let lastData: unknown = null;
      return callback({
        revision: {
          create: vi.fn(async () => ({ id: 'rev-new' })),
          update: vi.fn(),
          delete: vi.fn(),
        },
        problem: {
          update: vi.fn((args) => args.data),
          updateMany: vi.fn(async (args: { data: unknown }) => {
            lastData = args.data;
            return { count: 1 };
          }),
          findUnique: vi.fn(async () => lastData),
        },
      });
    }),
  },
}));

describe('POST /api/problems/[id]/undo-revision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth as any).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/problems/p1/undo-revision', { method: 'POST' });
    const res = await undoRevisionHandler(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when problem not found', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(prisma.problem.findFirst).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/problems/p1/undo-revision', { method: 'POST' });
    const res = await undoRevisionHandler(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 400 when problem has no revisions to undo', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(prisma.problem.findFirst).mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      createdAt: new Date(),
      revisionCount: 0,
      revisions: [],
    } as any);

    const req = new NextRequest('http://localhost/api/problems/p1/undo-revision', { method: 'POST' });
    const res = await undoRevisionHandler(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
  });

  it('successfully undoes the latest revision and decrements revision count', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } } as any);
    const now = new Date();
    vi.mocked(prisma.problem.findFirst).mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      createdAt: new Date(now.getTime() - 86400000 * 3),
      revisionCount: 1,
      revisions: [
        {
          id: 'rev-1',
          stepBefore: 0,
          stepAfter: 1,
          type: 'REGULAR',
          confidence: 'CLEAN',
          revisedAt: now,
        },
      ],
    } as any);

    vi.mocked(prisma.revision.count).mockResolvedValue(0);

    const req = new NextRequest('http://localhost/api/problems/p1/undo-revision', { method: 'POST' });
    const res = await undoRevisionHandler(req, { params: Promise.resolve({ id: 'p1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.problem.currentStep).toBe(0);
    expect(json.problem.revisionCount).toBe(0);
    expect(json.problem.status).toBe('ACTIVE');
  });
});

describe('PATCH /api/problems/[id]/revise with replaceLatest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('re-applies the revision with new confidence without incrementing revisionCount', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } } as any);
    const now = new Date();
    vi.mocked(prisma.problem.findFirst).mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      currentStep: 1,
      revisionCount: 1,
      status: 'ACTIVE',
      revisions: [
        {
          id: 'rev-1',
          stepBefore: 0,
          stepAfter: 1,
          type: 'REGULAR',
          confidence: 'CLEAN',
          revisedAt: now,
        },
      ],
    } as any);

    const req = new NextRequest('http://localhost/api/problems/p1/revise', {
      method: 'PATCH',
      body: JSON.stringify({ confidence: 'STRUGGLED', replaceLatest: true }),
    });
    const res = await reviseHandler(req, { params: Promise.resolve({ id: 'p1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.currentStep).toBe(0);
    expect(json.status).toBe('ACTIVE');
  });
});

describe('same-day rules for revise and undo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const problemWithRevisionAt = (revisedAt: Date) =>
    ({
      id: 'p1',
      userId: 'u1',
      currentStep: 1,
      revisionCount: 1,
      status: 'ACTIVE',
      createdAt: new Date(revisedAt.getTime() - 86400000 * 3),
      nextRevisionAt: new Date(),
      revisions: [{ id: 'rev-1', stepBefore: 0, stepAfter: 1, type: 'REGULAR', confidence: 'CLEAN', revisedAt }],
    }) as any;

  it('refuses a second plain rating on the same day', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(prisma.problem.findFirst).mockResolvedValue(problemWithRevisionAt(new Date()));

    const req = new NextRequest('http://localhost/api/problems/p1/revise', {
      method: 'PATCH',
      body: JSON.stringify({ confidence: 'CLEAN' }),
    });
    const res = await reviseHandler(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses to change a rating from an earlier day', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(prisma.problem.findFirst).mockResolvedValue(
      problemWithRevisionAt(new Date(Date.now() - 3 * 86400000))
    );

    const req = new NextRequest('http://localhost/api/problems/p1/revise', {
      method: 'PATCH',
      body: JSON.stringify({ confidence: 'STRUGGLED', replaceLatest: true }),
    });
    const res = await reviseHandler(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(409);
  });

  it('refuses to undo a rating from an earlier day', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(prisma.problem.findFirst).mockResolvedValue(
      problemWithRevisionAt(new Date(Date.now() - 3 * 86400000))
    );

    const req = new NextRequest('http://localhost/api/problems/p1/undo-revision', { method: 'POST' });
    const res = await undoRevisionHandler(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('user ladder and revisionId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const customPrefs = {
    timezone: null,
    dailyGoal: 5,
    defaultPlatform: 'LEETCODE',
    ladderDays: [2, 4, 8, 16],
    remindersEnabled: false,
    reminderHour: 9,
    goalBasedStreak: false,
  };
  const DAY = 86400000;

  it('schedules a new rating with the user ladder and returns the revisionId', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(customPrefs as any);
    vi.mocked(prisma.problem.findFirst).mockResolvedValue({
      id: 'p1',
      currentStep: 0,
      status: 'ACTIVE',
      nextRevisionAt: new Date(),
      revisions: [{ id: 'old', type: 'REGULAR', stepBefore: 0, revisedAt: new Date(Date.now() - 5 * DAY) }],
    } as any);

    const before = Date.now();
    const req = new NextRequest('http://localhost/api/problems/p1/revise', {
      method: 'PATCH',
      body: JSON.stringify({ confidence: 'CLEAN' }),
    });
    const res = await reviseHandler(req, { params: Promise.resolve({ id: 'p1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.revisionId).toBe('rev-new');
    expect(json.currentStep).toBe(1);
    // Step 1 of [2, 4, 8, 16] is 4 days, not the default 7.
    const days = Math.round((new Date(json.nextRevisionAt).getTime() - before) / DAY);
    expect(days).toBe(4);
  });

  it('restores the schedule with the user ladder on undo', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(customPrefs as any);
    const createdAt = new Date(Date.now() - 10 * DAY);
    vi.mocked(prisma.problem.findFirst).mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      createdAt,
      revisionCount: 1,
      revisions: [{ id: 'rev-1', stepBefore: 0, stepAfter: 1, type: 'REGULAR', confidence: 'CLEAN', revisedAt: new Date() }],
    } as any);
    vi.mocked(prisma.revision.count).mockResolvedValue(0);

    const req = new NextRequest('http://localhost/api/problems/p1/undo-revision', {
      method: 'POST',
      body: JSON.stringify({ revisionId: 'rev-1' }),
    });
    const res = await undoRevisionHandler(req, { params: Promise.resolve({ id: 'p1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    // No earlier rating: back to createdAt + ladder[0] (2 days).
    expect(new Date(json.problem.nextRevisionAt).getTime()).toBe(createdAt.getTime() + 2 * DAY);
  });

  it('refuses to undo when the revisionId is no longer the latest', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(prisma.problem.findFirst).mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      createdAt: new Date(),
      revisionCount: 1,
      revisions: [{ id: 'rev-2', stepBefore: 0, stepAfter: 1, type: 'REGULAR', confidence: 'CLEAN', revisedAt: new Date() }],
    } as any);

    const req = new NextRequest('http://localhost/api/problems/p1/undo-revision', {
      method: 'POST',
      body: JSON.stringify({ revisionId: 'rev-1' }),
    });
    const res = await undoRevisionHandler(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('concurrent ratings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 409 when another rating changed the problem first', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(prisma.problem.findFirst).mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      currentStep: 0,
      revisionCount: 0,
      status: 'ACTIVE',
      nextRevisionAt: new Date(),
      updatedAt: new Date(),
      revisions: [],
    } as any);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: any) =>
      callback({
        revision: { create: vi.fn() },
        problem: { updateMany: vi.fn(async () => ({ count: 0 })), findUnique: vi.fn() },
      })
    );

    const req = new NextRequest('http://localhost/api/problems/p1/revise', {
      method: 'PATCH',
      body: JSON.stringify({ confidence: 'CLEAN' }),
    });
    const res = await reviseHandler(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(409);
  });
});
