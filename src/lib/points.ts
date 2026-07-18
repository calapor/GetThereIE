import { prisma } from "./db";
import { computeBonus, BASE_POINTS } from "./points-core";

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
  const bonus = computeBonus(votes.map((r) => r.vote), vote);
  awarded = bonus.awarded;
  multiplier = bonus.multiplier;

  const user = await prisma.user.update({
    where: { id: userId },
    data: { points: { increment: awarded } },
  });

  return { awarded, multiplier, totalPoints: user.points };
}
