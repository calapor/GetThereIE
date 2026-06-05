"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredUser } from "@/lib/user";

interface Props {
  refreshTrigger?: number;
}

export default function PointsHeader({ refreshTrigger }: Props) {
  const [points, setPoints] = useState<number | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) return;
    setPoints(user.points);

    fetch(`/api/leaderboard?userId=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        setRank(data.myRank);
        setTotal(data.total);
        // Sync latest server points
        const me = data.users.find((u: { id: string }) => u.id === user.id);
        if (me) setPoints(me.points);
      })
      .catch(() => {});
  }, [refreshTrigger]);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="text-sm font-semibold text-blue-600">
        {points !== null ? (
          <>
            {points} Points
            {rank !== null && total !== null && (
              <span className="text-gray-500 font-normal ml-2">
                — {rank}{ordinal(rank)} out of {total}
              </span>
            )}
          </>
        ) : (
          <span className="text-gray-400">Loading…</span>
        )}
      </div>
      <Link href="/leaderboard" className="text-xl" aria-label="Leaderboard">
        ⚙️
      </Link>
    </header>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
