-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyGoal" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "defaultPlatform" "Platform" NOT NULL DEFAULT 'LEETCODE',
ADD COLUMN     "goalBasedStreak" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ladderDays" INTEGER[] DEFAULT ARRAY[3, 7, 14, 30]::INTEGER[],
ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN     "reminderHour" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timezone" TEXT;

-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "code" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "UserColumnConfig" ADD COLUMN     "options" JSONB,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'text';

-- CreateTable
CREATE TABLE "ProblemList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "_ProblemToProblemList" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProblemToProblemList_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProblemList_userId_name_key" ON "ProblemList"("userId", "name");

-- CreateIndex
CREATE INDEX "_ProblemToProblemList_B_index" ON "_ProblemToProblemList"("B");

-- AddForeignKey
ALTER TABLE "ProblemList" ADD CONSTRAINT "ProblemList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProblemToProblemList" ADD CONSTRAINT "_ProblemToProblemList_A_fkey" FOREIGN KEY ("A") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProblemToProblemList" ADD CONSTRAINT "_ProblemToProblemList_B_fkey" FOREIGN KEY ("B") REFERENCES "ProblemList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

