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
  if (q.length < 2) return NextResponse.json([]);

  const d = getDb();
  if (!d) return NextResponse.json([]);

  const rows = d
    .prepare(
      `SELECT stop_id, stop_name FROM stops
       WHERE stop_id LIKE '%DB%' AND stop_name LIKE ?
       ORDER BY stop_name ASC LIMIT 20`
    )
    .all(`%${q}%`) as { stop_id: string; stop_name: string }[];

  return NextResponse.json(rows);
}
