import type { BusArrival } from "./nta";
import { getLuasLineStops } from "./gtfs-db";

// Luas realtime uses the official RPA forecasting API (the same source the
// physical platform signs use). It's per-stop and keyed by the stop's
// abbreviation (e.g. "STS"), which scripts/add-luas.mjs stores on each stop.
const FORECAST_URL = "https://luasforecasts.rpa.ie/xml/get.ashx";
const CACHE_TTL_MS = 20_000;

interface CacheEntry {
  arrivals: BusArrival[];
  fetchedAt: number;
}
const cache = new Map<string, CacheEntry>();

function parseAttrs(s: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of s.matchAll(/(\w+)="([^"]*)"/g)) attrs[m[1]] = m[2];
  return attrs;
}

function fmtTime(unixSecs: number): string {
  const d = new Date(unixSecs * 1000);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

// Parse the forecast XML into board-compatible arrivals. `line` tags each tram
// with its route ("Red"/"Green") so the board can group + colour it.
function parseForecast(xml: string, abbrev: string, line: string): BusArrival[] {
  const now = Math.floor(Date.now() / 1000);
  const out: BusArrival[] = [];
  const routeId = `LUAS_${line.toUpperCase()}`;

  for (const dirMatch of xml.matchAll(/<direction\b([^>]*)>([\s\S]*?)<\/direction>/g)) {
    const dirName = (parseAttrs(dirMatch[1]).name || "").toLowerCase();
    const directionId = dirName === "inbound" ? 1 : 0;

    let idx = 0;
    for (const tramMatch of dirMatch[2].matchAll(/<tram\b([^>]*)\/?>/g)) {
      const a = parseAttrs(tramMatch[1]);
      const destination = (a.destination || "").trim();
      const dueRaw = (a.dueMins || "").trim();
      if (!destination || /no trams/i.test(destination)) continue;

      const minutesAway = /due/i.test(dueRaw) ? 0 : parseInt(dueRaw, 10);
      if (!Number.isFinite(minutesAway)) continue;

      const eta = now + minutesAway * 60;
      out.push({
        tripId: `LUAS_${abbrev}_${directionId}_${idx++}`,
        routeId,
        routeShortName: line,
        headsign: destination,
        directionId,
        arrivalTimestamp: eta,
        arrivalTime: fmtTime(eta),
        scheduledTime: fmtTime(eta),
        minutesAway,
        delaySeconds: 0,
        delayMinutes: 0,
        isStopping: true,
        occupancyStatus: null,
        historicalStopPct: null,
        stopId: `LUAS_${abbrev}`,
        isScheduled: false,
      });
    }
  }

  out.sort((x, y) => x.arrivalTimestamp - y.arrivalTimestamp);
  return out;
}

// Live tram arrivals at a Luas stop, in the same shape as bus arrivals.
export async function getLuasForecastForStop(abbrev: string, line: string): Promise<BusArrival[]> {
  const key = `${abbrev}|${line}`;
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) return hit.arrivals;

  try {
    const url = `${FORECAST_URL}?action=forecast&stop=${encodeURIComponent(abbrev)}&encrypt=false`;
    const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
    if (!res.ok) throw new Error(`Luas API ${res.status}`);
    const xml = await res.text();
    const arrivals = parseForecast(xml, abbrev, line);
    cache.set(key, { arrivals, fetchedAt: now });
    return arrivals;
  } catch {
    // Serve stale on transient failure rather than blanking the board.
    if (hit) return hit.arrivals;
    return [];
  }
}

export interface LuasLineTram {
  fromStopId: string;
  fromStop: string;
  destination: string;
  directionId: number;
  minutesAway: number;
}

// Lightweight "live now" overview for a Luas line. The forecast API is per-stop,
// so we fan out to just the two termini (bounded, cached) and report the next
// tram in each direction — deliberately lighter than the bus vehicle feed.
export async function getLuasLineOverview(line: string): Promise<LuasLineTram[]> {
  const stops = getLuasLineStops(line);
  if (stops.length === 0) return [];
  const termini = [stops[0], stops[stops.length - 1]].filter((s) => s.abbrev);

  const results = await Promise.all(
    termini.map(async (s) => {
      const arrivals = await getLuasForecastForStop(s.abbrev!, line);
      return arrivals.slice(0, 2).map((a) => ({
        fromStopId: s.stop_id,
        fromStop: s.stop_name,
        destination: a.headsign,
        directionId: a.directionId,
        minutesAway: a.minutesAway,
      }));
    })
  );

  return results.flat().sort((a, b) => a.minutesAway - b.minutesAway);
}
