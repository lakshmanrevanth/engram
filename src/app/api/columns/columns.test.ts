import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE as legacyDelete } from './route';
import { PATCH, DELETE } from './[id]/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

vi.mock('@/lib/prisma', () => {
  const client: any = {
    userColumnConfig: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    problem: { findMany: vi.fn(), update: vi.fn() },
  };
  client.$transaction = vi.fn(async (cb: any) => cb(client));
  return { prisma: client };
});

const db = prisma as any;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const json = (url: string, method: string, body: unknown) =>
  new NextRequest(url, { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

const cols = [
  { id: 'c1', userId: 'u1', name: 'Language', type: 'text', options: null, order: 0, createdAt: new Date(1) },
  { id: 'c2', userId: 'u1', name: 'Status', type: 'select', options: ['Todo', 'Done'], order: 1, createdAt: new Date(2) },
  { id: 'c3', userId: 'u1', name: 'Link', type: 'url', options: null, order: 2, createdAt: new Date(3) },
];

describe('/api/columns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } });
  });

  it('401 when signed out', async () => {
    vi.mocked(auth as any).mockResolvedValue(null);
    expect((await GET(new NextRequest('http://x/api/columns'))).status).toBe(401);
    expect((await PATCH(json('http://x/api/columns/c1', 'PATCH', {}), ctx('c1'))).status).toBe(401);
  });

  it('GET returns typed columns', async () => {
    db.userColumnConfig.findMany.mockResolvedValue(cols);
    const res = await GET(new NextRequest('http://x/api/columns'));
    const body = await res.json();
    expect(body[1]).toEqual({ id: 'c2', name: 'Status', type: 'select', options: ['Todo', 'Done'], order: 1 });
  });

  describe('POST', () => {
    beforeEach(() => db.userColumnConfig.findMany.mockResolvedValue(cols));

    it('rejects a case-insensitive duplicate name with 409', async () => {
      const res = await POST(json('http://x/api/columns', 'POST', { name: '  language ' }));
      expect(res.status).toBe(409);
      expect(db.userColumnConfig.create).not.toHaveBeenCalled();
    });

    it('rejects unknown types and bad options', async () => {
      expect((await POST(json('http://x/api/columns', 'POST', { name: 'X', type: 'number' }))).status).toBe(400);
      expect((await POST(json('http://x/api/columns', 'POST', { name: 'X', type: 'select', options: {} }))).status).toBe(400);
      expect((await POST(json('http://x/api/columns', 'POST', { name: '' }))).status).toBe(400);
    });

    it('creates a select column at the end with normalized options', async () => {
      db.userColumnConfig.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));
      const res = await POST(json('http://x/api/columns', 'POST', { name: 'Company', type: 'select', options: 'Google, google, Meta' }));
      expect(res.status).toBe(201);
      expect(db.userColumnConfig.create).toHaveBeenCalledWith({
        data: { userId: 'u1', name: 'Company', type: 'select', options: ['Google', 'Meta'], order: 3 },
      });
    });
  });

  describe('PATCH /api/columns/[id]', () => {
    beforeEach(() => {
      db.userColumnConfig.findMany.mockResolvedValue(cols);
      db.userColumnConfig.update.mockImplementation(async ({ where, data }: any) => ({ ...cols.find((c) => c.id === where.id), ...data }));
    });

    it('404 for a column the user does not own', async () => {
      const res = await PATCH(json('http://x/api/columns/zz', 'PATCH', { name: 'A' }), ctx('zz'));
      expect(res.status).toBe(404);
    });

    it('renames and moves the key in every problem inside the transaction', async () => {
      db.problem.findMany.mockResolvedValue([
        { id: 'p1', customFields: { Language: 'Go', Other: 'x' } },
        { id: 'p2', customFields: { Other: 'y' } },
        { id: 'p3', customFields: null },
      ]);
      const res = await PATCH(json('http://x/api/columns/c1', 'PATCH', { name: 'Lang' }), ctx('c1'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('Lang');
      expect(body.renamed).toBe(1);
      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(db.problem.update).toHaveBeenCalledTimes(1);
      expect(db.problem.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { customFields: { Lang: 'Go', Other: 'x' } } });
    });

    it('rejects renaming onto another column name', async () => {
      const res = await PATCH(json('http://x/api/columns/c1', 'PATCH', { name: 'STATUS' }), ctx('c1'));
      expect(res.status).toBe(409);
      expect(db.problem.update).not.toHaveBeenCalled();
    });

    it('validates type and order', async () => {
      expect((await PATCH(json('http://x/api/columns/c1', 'PATCH', { type: 'nope' }), ctx('c1'))).status).toBe(400);
      expect((await PATCH(json('http://x/api/columns/c1', 'PATCH', { order: -1 }), ctx('c1'))).status).toBe(400);
    });

    it('seeds options from existing values when switching to select', async () => {
      db.problem.findMany.mockResolvedValue([
        { customFields: { Language: 'Go' } },
        { customFields: { Language: 'go' } },
        { customFields: { Language: 'Rust' } },
      ]);
      const res = await PATCH(json('http://x/api/columns/c1', 'PATCH', { type: 'select' }), ctx('c1'));
      const body = await res.json();
      expect(body.type).toBe('select');
      expect(body.options).toEqual(['Go', 'Rust']);
    });

    it('reorders by renumbering all columns', async () => {
      const res = await PATCH(json('http://x/api/columns/c3', 'PATCH', { order: 0 }), ctx('c3'));
      expect(res.status).toBe(200);
      const calls = db.userColumnConfig.update.mock.calls.map((c: any) => [c[0].where.id, c[0].data.order]);
      expect(calls).toEqual([['c3', 0], ['c1', 1], ['c2', 2]]);
    });
  });

  describe('DELETE', () => {
    it('removes the column and its key from every problem', async () => {
      db.userColumnConfig.findFirst.mockResolvedValue(cols[0]);
      db.problem.findMany.mockResolvedValue([
        { id: 'p1', customFields: { Language: 'Go', Other: 'x' } },
        { id: 'p2', customFields: { Other: 'y' } },
      ]);
      const res = await DELETE(new NextRequest('http://x/api/columns/c1', { method: 'DELETE' }), ctx('c1'));
      expect(res.status).toBe(200);
      expect((await res.json()).cleared).toBe(1);
      expect(db.problem.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { customFields: { Other: 'x' } } });
      expect(db.userColumnConfig.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });

    it('legacy ?id= delete still works and 404s for unknown ids', async () => {
      db.userColumnConfig.findFirst.mockResolvedValue(null);
      const res = await legacyDelete(new NextRequest('http://x/api/columns?id=zz', { method: 'DELETE' }));
      expect(res.status).toBe(404);
      expect((await legacyDelete(new NextRequest('http://x/api/columns', { method: 'DELETE' }))).status).toBe(400);
    });
  });
});
