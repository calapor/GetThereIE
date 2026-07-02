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
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json([]);

  const d = getDb();
  if (!d) return NextResponse.json([]);

  const rows = d
    .prepare(
      `SELECT route_id, route_short_name, route_long_name
       FROM routes
       WHERE route_short_name LIKE ? OR route_long_name LIKE ?
       ORDER BY
         CASE WHEN route_short_name LIKE ? THEN 0 ELSE 1 END,
         route_short_name ASC
       LIMIT 20`
    )
    .all(`${q}%`, `%${q}%`, `${q}%`) as { route_id: string; route_short_name: string; route_long_name: string }[];

  return NextResponse.json(rows);
}
