import { prisma } from "./db";

const BASE_POINTS = 5;
const BONUS_POINTS = 10;
const MAJORITY_THRESHOLD = 3;

export interface PointsResult {
  awarded: number;
  multiplier: number | null;
  totalPoints: number;
}

export async function awardPoints(
  userId: string,
  stopId: string,
  routeId: string,
  tripId: string,
  type: "STOPPED" | "ON_TIME",
  vote: boolean
): Promise<PointsResult> {
  let awarded = 0;
  let multiplier: number | null = null;

  try {
    await prisma.report.create({
      data: { userId, stopId, routeId, tripId, type, vote },
    });
    awarded = BASE_POINTS;
  } catch {
    // duplicate vote (unique constraint) — no points
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return { awarded: 0, multiplier: null, totalPoints: user?.points ?? 0 };
  }

  // Check if this vote matches the majority with enough votes to trigger bonus
  const votes = await prisma.report.findMany({ where: { tripId, type } });
  if (votes.length >= MAJORITY_THRESHOLD) {
    const upVotes = votes.filter((r) => r.vote).length;
    const majority = upVotes > votes.length / 2;
    if (vote === majority) {
      awarded += BONUS_POINTS;
      multiplier = 3;
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { points: { increment: awarded } },
  });

  return { awarded, multiplier, totalPoints: user.points };
}
