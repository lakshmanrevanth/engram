-- Before adding the unique index, clear the code on any later duplicate of a
-- (user, platform, code) so the index can be created. The oldest row keeps its code.
UPDATE "Problem" SET "code" = NULL
WHERE "code" IS NOT NULL
  AND "id" NOT IN (
    SELECT DISTINCT ON ("userId", "platform", "code") "id"
    FROM "Problem"
    WHERE "code" IS NOT NULL
    ORDER BY "userId", "platform", "code", "createdAt" ASC
  );

-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "recallQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "Problem_userId_platform_code_key" ON "Problem"("userId", "platform", "code");

