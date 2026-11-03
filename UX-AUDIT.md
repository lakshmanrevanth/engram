# UX audit and backlog — recall

Review date: 2026-11-03 · Branch: `ux-overhaul`

The review covered the daily review flow, the dashboard table, adding and importing problems, auth, settings, navigation, accessibility and the scheduling logic. **Every item below is now fixed on this branch**, apart from the few listed under "Known limits" at the end.

Severity: **H** = bug, data loss or security; **M** = clear friction; **L** = polish.

---

## New: System Design concepts

You can now track system design concepts alongside coding problems, on the **System Design** page (`/concepts`, in the sidebar).

- **Logging a concept.** Pick one from a built-in library of 58 concepts in 10 categories (fundamentals, networking, storage, caching, messaging, distributed systems, reliability, architecture, observability, case studies), or type your own.
  - Set the date you learned it, your notes in your own words, and an optional source link.
- **Recall questions.** Every library concept comes with 3 questions to answer from memory. They are saved with your notes, so the daily "Reveal notes" step shows them when the concept is due.
- **Scheduling.** Concepts use your review intervals (3/7/14/30 by default), measured from the day you learned them. After that, a 90-day recheck.
- **Everywhere else.** Due concepts appear in the Daily queue, the streak and the heatmap, and are included in reminder emails ("…including 2 system design concepts"). They can also be filtered in the dashboard and exported or restored with backups.
- **Learning paths (default tab).** The 7 reading paths from [Vidya](https://www.vidya-bodha.com/paths) by @Harry_The_Nerd, 66 articles in total. Each path is worked through in order: only the next article can be marked as learned, and the server enforces it.
  - Marking an article as learned adds it to your review schedule from today, with recall questions for its type (HLD, LLD or concept).
  - Progress is shown per path and overall.
  - Only titles, one-line summaries and links are stored; articles open on the original site.
  - Code: `src/lib/concepts/paths.ts`, `src/app/(app)/concepts/learning-paths.tsx`.
- **How it's stored.** Concepts are problems with the platform `SYSTEM_DESIGN`, so undo, snooze, focus mode and everything else work the same way.
  - Code: `src/lib/concepts/library.ts`, `src/app/api/concepts`, `src/app/(app)/concepts`.

## 1. Missing or broken logic

| # | Sev | Problem | Fix |
|---|---|---|---|
| 1.1 | H | Streak, heatmap, "completed today" and undo used the server's day (UTC), not the user's | Timezone cookie plus a saved timezone setting; every day boundary uses `src/lib/dates.ts` |
| 1.2 | H | Mastered problems never came back; the "recheck" rules couldn't run | 90-day recheck; "Revise again" scores it as a recheck |
| 1.3 | H | The same problem could be rated twice in a day | Server returns 409 |
| 1.4 | H | Undo and "change rating" could rewrite old history | Limited to today, and checked against the revision id |
| 1.5 | H | Changing status skipped the schedule | Status changes reschedule, using your own intervals |
| 1.6 | H | The status filter did nothing | Fixed (the filter logic now lives in `filters.ts`, with tests) |
| 1.7 | M | Overdue backlog showed as a wall of rows | Weakest memories first, 20 at a time |
| 1.8 | M | The daily target setting was never used | Saved on the server, with a progress bar on the daily page |
| 1.9 | M | One review kept the streak alive | Optional setting: "streak counts only when the daily goal is met" |
| 1.10 | M | Preferences only lived in the browser | Stored on the user: timezone, goal, default platform, intervals, reminders |
| 1.11 | M | Review intervals were fixed for everyone | Each user can edit their 4 intervals in Settings |
| 1.12 | M | No reminder emails | Hourly cron at the user's chosen local hour, sent only when something is due |
| 1.13 | M | Solve date, title and URL couldn't be edited | Edit panel; the solve date sets the first review |
| 1.14 | L | Codeforces/CodeChef codes weren't stored | `code` column, shown in the table and searchable |

## 2. Security

| # | Sev | Problem | Fix |
|---|---|---|---|
| 2.1 | H | Email/reset codes could be guessed with no limit | 5 tries, then the code is locked |
| 2.2 | H | Account takeover by signing up first, then the owner using Google/GitHub | The unverified password is removed when OAuth verifies the account |
| 2.3 | H | Open redirect after login | Same-site paths only |
| 2.4 | M | Names weren't escaped in emails | Escaped |
| 2.5 | M | Codes were logged in production | Only in development |
| 2.6 | H | No rate limiting | Per-IP and per-email limits on every auth route and on password sign-in |
| 2.7 | M | Responses revealed which emails have accounts | Same response in every case, including signup |
| 2.8 | M | A password reset didn't sign out other sessions | Sessions issued before the change end within 5 minutes |
| 2.9 | M | "Email not verified" showed as "Invalid password" | Goes to the verify screen and sends a fresh code |

## 3. Daily review

| # | Sev | Problem | Fix |
|---|---|---|---|
| 3.1 | H | A failed load said "all caught up" | Error message with a retry button |
| 3.2 | M | Ratings didn't say what would happen next | Each button shows when the problem comes back, using your intervals |
| 3.3 | M | No lateness shown | "3d late" and "Recheck" chips |
| 3.4 | M | Success messages were styled red like errors | One stacked toast area: success, error, and an undo for each review |
| 3.5 | M | A tab left open showed yesterday's queue | Rolls over at midnight |
| 3.6 | M | New users saw "all caught up" | Explains how reviews work |
| 3.7 | M | Heatmap dates were off by a day | Local dates; keyboard and screen-reader labels |
| 3.8 | M | No recall step before rating | Expand a row: try to recall → reveal notes → rate |
| 3.9 | M | No keyboard support | Focus mode (`f`), 1/2/3, Space, s, u, j/k, Ctrl+Z, `?` for help |
| 3.10 | M | No snooze, skip or retire | Row ⋯ menu: snooze 1d/3d/1w, retire, open problem |
| 3.11 | M | Toasts overlapped | Fixed |
| 3.12 | L | Rows broke on phones | Card layout on small screens |

## 4. Dashboard, adding, import and export

| # | Sev | Problem | Fix |
|---|---|---|---|
| 4.1 | H | Deleting was instant, with no undo | Confirm for several rows; "Deleted · Undo" for 6 seconds |
| 4.2 | H | Selection survived view changes | Fixed |
| 4.3 | H | Bulk changes failed silently and sent N requests | One bulk request, run as a single transaction |
| 4.4 | M | Search only matched the title | Also matches code, topic, tags and notes |
| 4.5 | H | Adding saved instantly; drafts were lost | Draft row with every field; Enter saves, Esc asks before discarding |
| 4.6 | H | Failed lookups dead-ended | Manual entry fallback; live Codeforces lookup |
| 4.7 | M | Filters were too limited | Platform, topic/tag, overdue, due this week, list, and group-by; saved in the URL |
| 4.8 | M | Empty states were misleading | First-run panel, "No matches · Clear filters", and the next review date |
| 4.9 | M | One topic only; no lists | Tags, plus named lists (Blind 75, …) with bulk "Add to list" |
| 4.10 | M | Export and import didn't round-trip | Full JSON backup (v2) restores everything; Skip / Merge / Overwrite; CSV export is formula-safe |
| 4.11 | M | Custom columns were text only | Text, select, date, checkbox and link types; rename, reorder, and delete with a confirmation |
| 4.12 | M | Phones got a 1230px table | Card layout with long-press to select |
| 4.13 | M | Long lists rendered every row | Shows 100 rows, then "Show 100 more" |

## 5. Accessibility, navigation, account

| # | Sev | Problem | Fix |
|---|---|---|---|
| 5.1 | M | No visible keyboard focus | Focus ring in both themes; skip link |
| 5.2 | M | Dark-mode text failed contrast | Every text colour now meets AA (e.g. muted text went from 3.3:1 to 4.9:1) |
| 5.3 | M | No reduced-motion support | Respected everywhere; animations also pause when the tab is hidden |
| 5.4 | M | Login wasn't a real form | Real forms: Enter submits, labels, autocomplete, one-time-code |
| 5.5 | M | Mobile nav was missing items | "More" sheet with theme, Feedback and Sign out |
| 5.6 | M | No account management | Change password, change email (verified by code), unlink a sign-in method, delete account |
| 5.7 | L | Heavy, unused images | Share image 1.5 MB → 260 KB; unused files removed |
| 5.8 | L | The theme ignored the system setting | Light / Dark / System |
| 5.9 | L | Login logic was duplicated | One shared hook for both layouts; a CSS breakpoint replaces the JS switch |

---

## Known limits

- No undo for snooze or retire. Each shows a message, and you can change status from the table.
- Other sessions end within about 5 minutes of a password change, not instantly.
- Reminders run hourly, which needs Vercel Pro. On Hobby, change `vercel.json` to a daily schedule.
- Codeforces split problems (e.g. 1234C1) tracked before this change keep their old number.
- Linking a new sign-in provider from Settings isn't offered. You can unlink one.
- Per-IP rate limits trust the `x-forwarded-for` header. That is correct on Vercel, which sets it. On another host, make sure your proxy overwrites the header, or clients can fake it to get around the per-IP limits.

## Deploying

1. Apply the database migrations: `npx prisma migrate deploy`. There are 3 new ones:
   - `20261103120000_schedule_mastery_rechecks`: data only.
   - `20261103130000_preferences_lists_tags`: preferences, tags, codes, lists, column types, rate-limit table.
   - `20261103140000_system_design_platform`: adds `SYSTEM_DESIGN` to the platform enum.
   - If you use `prisma db push`, also run the SQL in the first one once by hand.
2. Set the new environment variables:
   - `CRON_SECRET`: Vercel sends it to `/api/cron/reminders`.
   - `RESEND_API_KEY` and `EMAIL_FROM`: needed for verification, reset and reminder emails.
   - `NEXT_PUBLIC_APP_URL`: used for links in emails.
