import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AUTH_DIR, CREDENTIALS_FILE, type E2EUser } from './paths';

// Creates a fresh, verified user directly in the database for this run and writes its
// credentials to e2e/.auth/user.json. The auth setup project then signs in through the
// real login form.
export default async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Put it in .env locally, or set it in the CI environment.');
  }
  const prisma = new PrismaClient();
  try {
    const email = `e2e-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.com`;
    const password = `E2e-${crypto.randomBytes(9).toString('base64url')}`;
    const user = await prisma.user.create({
      data: {
        email,
        name: 'E2E Tester',
        password: await bcrypt.hash(password, 10),
        emailVerified: new Date(),
      },
      select: { id: true },
    });

    // Login is rate limited (5 attempts per 15 min per email+IP); start each run clean.
    await prisma.rateLimit.deleteMany();

    fs.mkdirSync(AUTH_DIR, { recursive: true });
    const creds: E2EUser = { id: user.id, email, password };
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
