import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { CREDENTIALS_FILE, type E2EUser } from './paths';

// Deletes the run's test user; problems, revisions, sessions etc. go with it (onDelete: Cascade).
export default async function globalTeardown() {
  if (!fs.existsSync(CREDENTIALS_FILE)) return;
  const { id, email } = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8')) as E2EUser;
  // Never touch anything but an e2e account.
  if (!email.startsWith('e2e-') || !email.endsWith('@example.com')) return;
  const prisma = new PrismaClient();
  try {
    await prisma.user.deleteMany({ where: { id, email } });
  } finally {
    await prisma.$disconnect();
  }
}
