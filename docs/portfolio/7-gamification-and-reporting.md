# 7 — Gamification & Reporting

A lightweight loop that lets riders report what they see and earn points for it, building a
community picture of service quality.

## What a user reports

On a stop's arrival board, the most recent bus for each route shows two thumbs up/down controls
(`src/components/ThumbButtons.tsx`, wired in `RouteCard.tsx`):

- **"Stopped?"** → a report of `type: "STOPPED"`
- **"On time?"** → a report of `type: "ON_TIME"`

Each control produces a boolean `vote` (👍 `true` / 👎 `false`). A vote is attached to a specific
`(userId, stopId, routeId, tripId, type)` and posted to `POST /api/report`. The UI optimistically
records the vote and disables the buttons once cast.

## What counts as a valid report

Enforced server-side in `POST /api/report` and `awardPoints` (`src/lib/points.ts`):

1. **All fields present** — `userId, stopId, routeId, tripId, type, vote` — else a 400.
2. **`type` restricted** to `ON_TIME` or `STOPPED`.
3. **One vote per user, per trip, per type.** The `@@unique([userId, tripId, type])` constraint on
   the `Report` model means a duplicate insert fails; `awardPoints` catches it and returns
   `{ awarded: 0 }` with the user's unchanged total. This is what stops repeat-vote point farming.

## The points rule

The scoring rule is isolated as a **pure function**, `computeBonus`, in `src/lib/points-core.ts` so
it can be unit-tested with no database:

```ts
export const BASE_POINTS = 5;
export const BONUS_POINTS = 10;
export const MAJORITY_THRESHOLD = 3;

export function computeBonus(votes: boolean[], vote: boolean): BonusResult {
  let awarded = BASE_POINTS;
  let multiplier: number | null = null;
  if (votes.length >= MAJORITY_THRESHOLD) {
    const upVotes = votes.filter((v) => v).length;
    const majority = upVotes > votes.length / 2;   // exact tie => majority = false
    if (vote === majority) { awarded += BONUS_POINTS; multiplier = 3; }
  }
  return { awarded, multiplier };
}
```

- **Base:** 5 points for any accepted report.
- **Majority bonus:** once a trip+type has **≥3 votes**, a vote that **agrees with the current
  majority** earns **+10** (a `multiplier: 3` flag drives the celebratory UI). An exact tie resolves
  the majority to `false`.

The bonus rewards agreeing with the crowd, which nudges the aggregate signal toward consensus. The
sequence in `awardPoints` is: insert the report (base points), recount all votes for that trip+type
**including the new one**, recompute the bonus, then increment the user's total accordingly.

## Points feedback

When points are awarded the client shows a `PointsAlert` (with the multiplier when a bonus fired),
updates the locally stored total, and bubbles an `onPointsEarned` event so the header point counter
refreshes.

## Leaderboard (current state)

The leaderboard view (`/leaderboard`) and its API (`GET /api/leaderboard`) currently return
**placeholder data** — a fixed list of sample users plus a synthesised rank for the caller. Likewise
`POST /api/user` registers usernames into an in-memory map rather than the database. Only the
**report → points write path** persists to the Prisma app DB (`User.points`, `Report`). Wiring the
leaderboard to read real `User` rows is the natural next step; it is called out honestly here so the
documentation matches the code.

## Relationship to the AI roadmap

These reports are explicitly intended as the **training signal** for the planned "this bus may be
late / full" predictions (`docs/ai-predictions.md`). That work is **not implemented** — the board's
Fullness and Historical columns render placeholders, and the `occupancyStatus`/`historicalStopPct`
fields on `BusArrival` are always `null` today. The reporting loop exists now so that, if the
prediction features are built later, historical observations already exist to learn from.
