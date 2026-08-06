import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");

  const [users, total] = await Promise.all([
    prisma.user.findMany({ orderBy: { points: "desc" }, take: 50 }),
    prisma.user.count(),
  ]);

  const ranked = users.map((u, i) => ({
    position: i + 1,
    id: u.id,
    username: u.username,
    points: u.points,
  }));

  let myRank: number | null = null;
  if (userId) {
    const me = await prisma.user.findUnique({ where: { id: userId } });
    if (me) {
      const above = await prisma.user.count({ where: { points: { gt: me.points } } });
      myRank = above + 1;
    }
  }

  return NextResponse.json({ users: ranked, myRank, total });
}
