import BetterSqlite3 from "better-sqlite3";
import { existsSync } from "fs";
import path from "path";

let db: BetterSqlite3.Database | null = null;

function getDb(): BetterSqlite3.Database | null {
  if (db !== null) return db;
  const dbPath = path.join(process.cwd(), "gtfs.db");
  if (!existsSync(dbPath)) return null;
  db = new BetterSqlite3(dbPath, { readonly: true });
  return db;
}

export function getScheduledArrivalSecs(
  tripId: string,
  stopId: string
): number | null {
  const d = getDb();
  if (!d) return null;
  const row = d
    .prepare(
      "SELECT arrival_secs FROM stop_times WHERE trip_id = ? AND stop_id = ? LIMIT 1"
    )
    .get(tripId, stopId) as { arrival_secs: number } | undefined;
  return row?.arrival_secs ?? null;
}

export function getHeadsignForRoute(routeShortName: string, directionId: number): string | null {
  const d = getDb();
  if (!d) return null;
  const row = d
    .prepare(
      `SELECT t.headsign
       FROM trips t JOIN routes r ON r.route_id = t.route_id
       WHERE r.route_short_name = ? AND t.direction_id = ? AND t.headsign != ''
       GROUP BY t.headsign ORDER BY COUNT(*) DESC LIMIT 1`
    )
    .get(routeShortName, directionId) as { headsign: string } | undefined;
  return row?.headsign ?? null;
}

export function getStopName(stopId: string): string | null {
  const d = getDb();
  if (!d) return null;
  const row = d
    .prepare("SELECT stop_name FROM stops WHERE stop_id = ? LIMIT 1")
    .get(stopId) as { stop_name: string } | undefined;
  return row?.stop_name ?? null;
}
