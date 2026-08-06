export interface WeatherContext {
  precipitationMm: number | null;
  windKmh: number | null;
  temperatureC: number | null;
}

export interface CalendarContext {
  isBankHoliday: boolean;
  isSchoolHoliday: boolean;
  isCollegeHoliday: boolean;
}

export interface VoteCounts {
  positive: number;
  total: number;
}

export interface PredictionResult {
  probability: number;
  sampleCount: number;
  factors: string[];
}

// Bayesian-smoothed probability. priorWeight virtual votes pull toward prior.
export function smoothedProbability(
  positive: number,
  total: number,
  prior = 0.5,
  priorWeight = 2
): number {
  return (positive + prior * priorWeight) / (total + priorWeight);
}

export function predictStopProbability(params: {
  stopVotes: VoteCounts;
  fullEarlierOnRoute: number;
  weather: WeatherContext;
  calendar: CalendarContext;
}): PredictionResult {
  const { stopVotes, fullEarlierOnRoute, weather, calendar } = params;
  const factors: string[] = [];

  let prob = smoothedProbability(stopVotes.positive, stopVotes.total, 0.8, 2);

  if (fullEarlierOnRoute > 0) {
    const penalty = Math.min(0.3, fullEarlierOnRoute * 0.1);
    prob = Math.max(0.05, prob - penalty);
    factors.push(`full ${fullEarlierOnRoute} stop${fullEarlierOnRoute > 1 ? "s" : ""} back`);
  }

  if (calendar.isBankHoliday) {
    prob = Math.min(0.99, prob + 0.05);
    factors.push("bank holiday");
  }

  return {
    probability: Math.min(0.99, Math.max(0.01, prob)),
    sampleCount: stopVotes.total,
    factors,
  };
}

export function predictOnTimeProbability(params: {
  onTimeVotes: VoteCounts;
  weather: WeatherContext;
  calendar: CalendarContext;
}): PredictionResult {
  const { onTimeVotes, weather, calendar } = params;
  const factors: string[] = [];

  let prob = smoothedProbability(onTimeVotes.positive, onTimeVotes.total, 0.6, 2);

  if ((weather.precipitationMm ?? 0) > 2) {
    prob = Math.max(0.05, prob - 0.15);
    factors.push("rain");
  }

  if (calendar.isBankHoliday) {
    prob = Math.min(0.99, prob + 0.08);
    factors.push("bank holiday");
  } else if (calendar.isSchoolHoliday) {
    prob = Math.min(0.99, prob + 0.05);
    factors.push("school holidays");
  }

  return {
    probability: Math.min(0.99, Math.max(0.01, prob)),
    sampleCount: onTimeVotes.total,
    factors,
  };
}

export function predictFullness(params: {
  fullVotes: VoteCounts;
  weather: WeatherContext;
  calendar: CalendarContext;
  hourOfDay?: number;
}): PredictionResult {
  const { fullVotes, weather, calendar, hourOfDay = new Date().getHours() } = params;
  const factors: string[] = [];

  let prob = smoothedProbability(fullVotes.positive, fullVotes.total, 0.3, 2);

  if ((weather.precipitationMm ?? 0) > 2) {
    prob = Math.min(0.99, prob + 0.12);
    factors.push("rain");
  }

  const isRushHour = (hourOfDay >= 7 && hourOfDay <= 9) || (hourOfDay >= 16 && hourOfDay <= 18);
  if (!calendar.isSchoolHoliday && isRushHour) {
    prob = Math.min(0.99, prob + 0.1);
    factors.push("school term rush hour");
  }

  return {
    probability: Math.min(0.99, Math.max(0.01, prob)),
    sampleCount: fullVotes.total,
    factors,
  };
}
