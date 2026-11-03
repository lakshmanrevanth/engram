-- Mastered problems now come back once for a long-term recheck (90 days after mastery).
-- Before this change, mastered problems kept the past due date they had when mastered,
-- so without this update they would all appear in the daily queue at once.
--
-- Each one is scheduled 90 days after it was last updated, but never sooner than
-- 1-30 days from now (spread by id), so existing users don't get a flood of rechecks.
-- Problems imported as "archive" (scheduled for 2099) are left alone.
UPDATE "Problem"
SET "nextRevisionAt" = GREATEST(
  "updatedAt" + INTERVAL '90 days',
  NOW() + ((ABS(HASHTEXT("id")) % 30) + 1) * INTERVAL '1 day'
)
WHERE "status" = 'MASTERED'
  AND "nextRevisionAt" < TIMESTAMP '2090-01-01';
