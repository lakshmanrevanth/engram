import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, PUT } from './route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { generateRecallQuestions, isAiConfigured, normalizeQuestions } from '@/lib/ai/recall-questions';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock('@/lib/prisma', () => ({
  prisma: { problem: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock('@/lib/ai/recall-questions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/recall-questions')>();
  return { ...actual, isAiConfigured: vi.fn(() => true), generateRecallQuestions: vi.fn() };
});

const params = { params: Promise.resolve({ id: 'p1' }) };
const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/problems/p1/questions', { method, body: body ? JSON.stringify(body) : undefined });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth as unknown as () => Promise<unknown>).mockResolvedValue({ user: { id: 'u1' } });
  vi.mocked(isAiConfigured).mockReturnValue(true);
});

describe('POST /api/problems/[id]/questions', () => {
  it('generates and saves questions, passing path summaries for path articles', async () => {
    vi.mocked(prisma.problem.findFirst).mockResolvedValue({
      id: 'p1', title: 'Design a Load Balancer', topic: 'System Design Fundamentals', difficulty: 'EASY',
      platform: 'SYSTEM_DESIGN', notes: 'L4 vs L7', url: 'https://x.com/a', code: 'path:system-design-fundamentals-2',
    } as never);
    vi.mocked(generateRecallQuestions).mockResolvedValue(['Q1?', 'Q2?', 'Q3?']);
    const res = await POST(req('POST'), params);
    expect(res.status).toBe(200);
    expect((await res.json()).questions).toEqual(['Q1?', 'Q2?', 'Q3?']);
    const subject = vi.mocked(generateRecallQuestions).mock.calls[0][0];
    expect(subject.kind).toBe('system-design');
    expect(subject.summary).toMatch(/load balancers/i);
    expect(prisma.problem.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { recallQuestions: ['Q1?', 'Q2?', 'Q3?'] } });
  });

  it('returns 503 when AI is not configured', async () => {
    vi.mocked(isAiConfigured).mockReturnValue(false);
    const res = await POST(req('POST'), params);
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('AI_NOT_CONFIGURED');
  });

  it('returns 404 for another user\'s problem', async () => {
    vi.mocked(prisma.problem.findFirst).mockResolvedValue(null);
    expect((await POST(req('POST'), params)).status).toBe(404);
    expect(generateRecallQuestions).not.toHaveBeenCalled();
  });
});

describe('PUT /api/problems/[id]/questions', () => {
  it('saves cleaned, de-duplicated questions', async () => {
    vi.mocked(prisma.problem.updateMany).mockResolvedValue({ count: 1 });
    const res = await PUT(req('PUT', { questions: ['  Why?  ', 'why?', '', 'How?'] }), params);
    expect((await res.json()).questions).toEqual(['Why?', 'How?']);
  });

  it('rejects a non-list body', async () => {
    expect((await PUT(req('PUT', { questions: 'x' }), params)).status).toBe(400);
  });
});

describe('normalizeQuestions', () => {
  it('caps at 5 and trims long questions', () => {
    const out = normalizeQuestions(Array.from({ length: 9 }, (_, i) => `Question ${i} ${'x'.repeat(400)}`));
    expect(out).toHaveLength(5);
    expect(out[0].length).toBe(300);
  });
});
