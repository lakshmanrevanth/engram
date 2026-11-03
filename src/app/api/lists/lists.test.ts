import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { PATCH, DELETE } from './[id]/route';
import { POST as MEMBERS } from './[id]/problems/route';
import { parseIds, parseListName } from './helpers';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    problemList: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    problem: { findMany: vi.fn() },
  },
}));

const url = 'http://localhost/api/lists';
const json = (method: string, body: unknown) => new NextRequest(url, { method, body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe('/api/lists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } });
  });

  it('requires auth everywhere', async () => {
    vi.mocked(auth as any).mockResolvedValue(null);
    expect((await GET(new NextRequest(url))).status).toBe(401);
    expect((await POST(json('POST', { name: 'x' }))).status).toBe(401);
    expect((await PATCH(json('PATCH', { name: 'x' }), ctx('l1'))).status).toBe(401);
    expect((await DELETE(new NextRequest(url, { method: 'DELETE' }), ctx('l1'))).status).toBe(401);
    expect((await MEMBERS(json('POST', { problemIds: ['p'], action: 'add' }), ctx('l1'))).status).toBe(401);
  });

  it('GET returns counts and member ids for the user only', async () => {
    vi.mocked(prisma.problemList.findMany).mockResolvedValue([
      { id: 'l1', name: 'Blind 75', createdAt: new Date(), problems: [{ id: 'p1' }, { id: 'p2' }] },
    ] as any);
    const res = await GET(new NextRequest(url));
    const body = await res.json();
    expect(body[0]).toMatchObject({ id: 'l1', name: 'Blind 75', count: 2, problemIds: ['p1', 'p2'] });
    expect(vi.mocked(prisma.problemList.findMany).mock.calls[0][0]!.where).toEqual({ userId: 'u1' });
  });

  it('POST validates and maps duplicates to 409', async () => {
    expect((await POST(json('POST', { name: '   ' }))).status).toBe(400);
    vi.mocked(prisma.problemList.count).mockResolvedValue(0);
    vi.mocked(prisma.problemList.create).mockRejectedValue({ code: 'P2002' });
    expect((await POST(json('POST', { name: 'Blind 75' }))).status).toBe(409);
    vi.mocked(prisma.problemList.create).mockResolvedValue({ id: 'l2', name: 'Grind', createdAt: new Date() } as any);
    const res = await POST(json('POST', { name: '  Grind  ' }));
    expect(res.status).toBe(201);
    expect(vi.mocked(prisma.problemList.create).mock.calls.at(-1)![0].data).toEqual({ userId: 'u1', name: 'Grind' });
  });

  it('PATCH and DELETE are ownership-scoped', async () => {
    vi.mocked(prisma.problemList.updateMany).mockResolvedValue({ count: 0 });
    expect((await PATCH(json('PATCH', { name: 'New' }), ctx('other'))).status).toBe(404);
    expect(vi.mocked(prisma.problemList.updateMany).mock.calls[0][0].where).toEqual({ id: 'other', userId: 'u1' });
    vi.mocked(prisma.problemList.deleteMany).mockResolvedValue({ count: 1 });
    expect((await DELETE(new NextRequest(url, { method: 'DELETE' }), ctx('l1'))).status).toBe(200);
    expect(vi.mocked(prisma.problemList.deleteMany).mock.calls[0][0]!.where).toEqual({ id: 'l1', userId: 'u1' });
  });

  it('membership: 404 for a foreign list, connects only owned problems', async () => {
    vi.mocked(prisma.problemList.findFirst).mockResolvedValue(null);
    expect((await MEMBERS(json('POST', { problemIds: ['p1'], action: 'add' }), ctx('x'))).status).toBe(404);

    expect((await MEMBERS(json('POST', { problemIds: ['p1'], action: 'move' }), ctx('l1'))).status).toBe(400);

    vi.mocked(prisma.problemList.findFirst).mockResolvedValue({ id: 'l1' } as any);
    vi.mocked(prisma.problem.findMany).mockResolvedValue([{ id: 'p1' }] as any);
    vi.mocked(prisma.problemList.update).mockResolvedValue({ problems: [{ id: 'p1' }] } as any);
    const res = await MEMBERS(json('POST', { problemIds: ['p1', 'foreign'], action: 'add' }), ctx('l1'));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.problem.findMany).mock.calls[0][0]!.where).toEqual({ id: { in: ['p1', 'foreign'] }, userId: 'u1' });
    expect(vi.mocked(prisma.problemList.update).mock.calls[0][0].data).toEqual({ problems: { connect: [{ id: 'p1' }] } });
    expect(await res.json()).toMatchObject({ changed: 1, count: 1 });
  });
});

describe('helpers', () => {
  it('parseListName trims and caps length', () => {
    expect(parseListName('  a   b ')).toEqual({ name: 'a b' });
    expect('error' in parseListName('x'.repeat(61))).toBe(true);
    expect('error' in parseListName(5)).toBe(true);
  });
  it('parseIds dedupes and rejects bad input', () => {
    expect(parseIds(['a', 'a', 'b'])).toEqual({ ids: ['a', 'b'] });
    expect('error' in parseIds('a')).toBe(true);
    expect('error' in parseIds([1])).toBe(true);
  });
});
