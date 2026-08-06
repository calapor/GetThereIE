import { prisma } from "./db";

const WEATHER_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface WeatherData {
  temperatureC: number | null;
  precipitationMm: number | null;
  windKmh: number | null;
}

const NULL_WEATHER: WeatherData = { temperatureC: null, precipitationMm: null, windKmh: null };

export async function getWeather(lat: number, lon: number): Promise<WeatherData> {
  const now = new Date();
  const dateHour = `${now.toISOString().slice(0, 13)}:${lat.toFixed(2)},${lon.toFixed(2)}`;

  const cached = await prisma.weatherCache.findUnique({ where: { dateHour } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < WEATHER_TTL_MS) {
    return { temperatureC: cached.temperatureC, precipitationMm: cached.precipitationMm, windKmh: cached.windKmh };
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,wind_speed_10m&timezone=Europe%2FDublin`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);

    const raw = await res.json() as { current?: { temperature_2m?: number; precipitation?: number; wind_speed_10m?: number } };
    const c = raw.current ?? {};
    const data: WeatherData = {
      temperatureC: c.temperature_2m ?? null,
      precipitationMm: c.precipitation ?? null,
      windKmh: c.wind_speed_10m ?? null,
    };

    await prisma.weatherCache.upsert({
      where: { dateHour },
      create: { dateHour, ...data, fetchedAt: now },
      update: { ...data, fetchedAt: now },
    });

    return data;
  } catch {
    if (cached) return { temperatureC: cached.temperatureC, precipitationMm: cached.precipitationMm, windKmh: cached.windKmh };
    return NULL_WEATHER;
  }
}
