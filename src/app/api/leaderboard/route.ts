import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");

  const top = await prisma.user.findMany({
    orderBy: { points: "desc" },
    take: 50,
    select: { id: true, username: true, points: true },
  });

  const ranked = top.map((u, i) => ({ position: i + 1, ...u }));

  let myRank: number | null = null;
  if (userId) {
    const allAbove = await prisma.user.count({
      where: { points: { gt: (await prisma.user.findUnique({ where: { id: userId } }))?.points ?? 0 } },
    });
    myRank = allAbove + 1;
  }

  const total = await prisma.user.count();

  return NextResponse.json({ users: ranked, myRank, total });
}
