import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { username } = await req.json();
  if (!username?.trim()) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }
  const trimmed = username.trim();
  try {
    const user = await prisma.user.create({ data: { username: trimmed } });
    return NextResponse.json({ id: user.id, username: user.username, points: user.points });
  } catch {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: user.id, username: user.username, points: user.points });
}
