// POST /api/problems/[id]/questions — generate recall questions with AI and save them
// PUT  /api/problems/[id]/questions — save questions edited by the user ({ questions: string[] })

import type { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import {
  AiOutputError,
  AiRefusalError,
  MAX_QUESTIONS,
  generateRecallQuestions,
  isAiConfigured,
  normalizeQuestions,
} from '@/lib/ai/recall-questions';
import { getPathArticle } from '@/lib/concepts/paths';

const HOUR = 60 * 60 * 1000;

async function ownedProblem(id: string, userId: string) {
  return prisma.problem.findFirst({
    where: { id, userId },
    select: { id: true, title: true, topic: true, difficulty: true, platform: true, notes: true, url: true, code: true },
  });
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const { id } = await params;

  if (!isAiConfigured()) {
    return Response.json({ error: 'AI questions are not set up on this server.', code: 'AI_NOT_CONFIGURED' }, { status: 503 });
  }

  const problem = await ownedProblem(id, userId);
  if (!problem) return Response.json({ error: 'Problem not found' }, { status: 404 });

  // Each generation is a paid API call: cap it per user.
  const limited = await rateLimit(`ai-questions:${userId}`, 30, HOUR);
  if (!limited.ok) {
    return Response.json(
      { error: `You've generated a lot of questions recently. Try again in ${Math.ceil(limited.retryAfterSec / 60)} min.` },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
    );
  }

  const pathEntry = problem.code?.startsWith('path:') ? getPathArticle(problem.code.slice(5)) : undefined;
  try {
    const questions = await generateRecallQuestions({
      title: problem.title,
      kind: problem.platform === 'SYSTEM_DESIGN' ? 'system-design' : 'coding-problem',
      topic: problem.topic,
      difficulty: problem.difficulty,
      summary: pathEntry?.article.summary ?? null,
      notes: problem.notes,
      url: problem.url || null,
    });
    await prisma.problem.update({ where: { id }, data: { recallQuestions: questions } });
    return Response.json({ questions });
  } catch (e) {
    if (e instanceof AiRefusalError || e instanceof AiOutputError) {
      return Response.json({ error: e.message }, { status: 422 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return Response.json({ error: 'The AI service is busy. Try again in a minute.' }, { status: 503 });
    }
    if (e instanceof Anthropic.APIError) {
      console.error('[POST questions] Anthropic API error', e.status, e.message);
      return Response.json({ error: 'The AI service failed. Try again later.' }, { status: 502 });
    }
    console.error('[POST /api/problems/[id]/questions]', e);
    return Response.json({ error: 'Failed to generate questions' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.questions)) {
    return Response.json({ error: 'questions must be a list' }, { status: 400 });
  }
  if (body.questions.length > MAX_QUESTIONS * 2) {
    return Response.json({ error: `At most ${MAX_QUESTIONS} questions` }, { status: 400 });
  }
  const questions = normalizeQuestions(body.questions);

  const result = await prisma.problem.updateMany({
    where: { id, userId: session.user.id },
    data: { recallQuestions: questions },
  });
  if (result.count === 0) return Response.json({ error: 'Problem not found' }, { status: 404 });
  return Response.json({ questions });
}
