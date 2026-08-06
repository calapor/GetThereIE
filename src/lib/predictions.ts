import { prisma } from "./db";
import { getStopCoords, getEarlierStopsOnTrip } from "./gtfs-db";
import { getWeather, type WeatherData } from "./weather";
import { getCalendarContext } from "./calendar-ie";
import {
  predictStopProbability,
  predictOnTimeProbability,
  predictFullness,
} from "./predictions-core";

export interface BusPrediction {
  stopProbability: number;
  onTimeProbability: number;
  fullnessProbability: number;
  predictionFactors: string[];
  predictionSampleCount: number;
}

interface VoteGroup {
  [key: string]: { positive: number; total: number };
}

const voteCache = new Map<string, { data: VoteGroup; at: number }>();
const VOTE_TTL = 60_000;

async function getVotesForStop(stopId: string): Promise<VoteGroup> {
  const cached = voteCache.get(stopId);
  if (cached && Date.now() - cached.at < VOTE_TTL) return cached.data;

  const reports = await prisma.report.findMany({
    where: { stopId },
    select: { routeId: true, type: true, vote: true },
  });

  const group: VoteGroup = {};
  for (const r of reports) {
    const k = `${r.routeId}:${r.type}`;
    if (!group[k]) group[k] = { positive: 0, total: 0 };
    group[k].total++;
    if (r.vote) group[k].positive++;
  }

  voteCache.set(stopId, { data: group, at: Date.now() });
  return group;
}

export async function getPredictionsForBuses(
  stopId: string,
  buses: { tripId: string; routeId: string }[]
): Promise<Map<string, BusPrediction>> {
  const result = new Map<string, BusPrediction>();
  if (buses.length === 0) return result;

  const coords = getStopCoords(stopId);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const nullWeather: WeatherData = { temperatureC: null, precipitationMm: null, windKmh: null };
  const [weather, votes] = await Promise.all([
    coords ? getWeather(coords.lat, coords.lon) : Promise.resolve(nullWeather),
    getVotesForStop(stopId),
  ]);
  const calendar = getCalendarContext(now);
  const hourOfDay = now.getHours();

  for (const bus of buses) {
    const stopVotes = votes[`${bus.routeId}:STOPPED`] ?? { positive: 0, total: 0 };
    const onTimeVotes = votes[`${bus.routeId}:ON_TIME`] ?? { positive: 0, total: 0 };
    const fullVotes = votes[`${bus.routeId}:FULL`] ?? { positive: 0, total: 0 };

    const earlierStops = getEarlierStopsOnTrip(bus.tripId, stopId);
    let fullEarlierOnRoute = 0;
    if (earlierStops.length > 0) {
      fullEarlierOnRoute = await prisma.report.count({
        where: {
          routeId: bus.routeId,
          stopId: { in: earlierStops },
          type: "FULL",
          vote: true,
          createdAt: { gte: todayStart },
        },
      });
    }

    const stopPred = predictStopProbability({ stopVotes, fullEarlierOnRoute, weather, calendar });
    const onTimePred = predictOnTimeProbability({ onTimeVotes, weather, calendar });
    const fullPred = predictFullness({ fullVotes, weather, calendar, hourOfDay });

    const allFactors = [...new Set([...stopPred.factors, ...onTimePred.factors, ...fullPred.factors])];
    const sampleCount = stopVotes.total + onTimeVotes.total + fullVotes.total;

    result.set(bus.tripId, {
      stopProbability: stopPred.probability,
      onTimeProbability: onTimePred.probability,
      fullnessProbability: fullPred.probability,
      predictionFactors: allFactors,
      predictionSampleCount: sampleCount,
    });
  }

  return result;
}
