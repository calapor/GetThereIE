import { NextRequest, NextResponse } from "next/server";

const dummyUsers: Record<string, { id: string; username: string; points: number }> = {};

export async function POST(req: NextRequest) {
  const { username } = await req.json();
  if (!username?.trim()) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const trimmed = username.trim();
  // Check if username already exists
  if (Object.values(dummyUsers).some((u) => u.username === trimmed)) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const id = `user_${Date.now()}`;
  const user = { id, username: trimmed, points: 0 };
  dummyUsers[id] = user;
  return NextResponse.json(user);
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const user = dummyUsers[id];
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}
