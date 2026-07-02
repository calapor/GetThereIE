import { NextRequest, NextResponse } from "next/server";
import BetterSqlite3 from "better-sqlite3";
import { existsSync } from "fs";
import path from "path";

let db: BetterSqlite3.Database | null = null;

function getDb() {
  if (db) return db;
  const dbPath = path.join(process.cwd(), "gtfs.db");
  if (!existsSync(dbPath)) return null;
  db = new BetterSqlite3(dbPath, { readonly: true });
  return db;
}

export async function GET(req: NextRequest) {
  const routeId = req.nextUrl.searchParams.get("routeId")?.trim() ?? "";
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!routeId) return NextResponse.json([]);

  const d = getDb();
  if (!d) return NextResponse.json([]);

  const rows = d
    .prepare(
      `SELECT DISTINCT st.stop_id, s.stop_name
       FROM stop_times st
       JOIN stops s ON s.stop_id = st.stop_id
       JOIN trips t ON t.trip_id = st.trip_id
       WHERE t.route_id = ?
         AND (? = '' OR s.stop_name LIKE ?)
       ORDER BY s.stop_name ASC
       LIMIT 50`
    )
    .all(routeId, q, `%${q}%`) as { stop_id: string; stop_name: string }[];

  return NextResponse.json(rows);
}
