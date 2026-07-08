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
    // Using dummy data for now - showing random rank and points
    setPoints(user.points || Math.floor(Math.random() * 500) + 50);
    setRank(Math.floor(Math.random() * 1000) + 1);
    setTotal(1500);
  }, [refreshTrigger]);

  return (
    <header className="sticky top-0 z-40 bg-[var(--card)] border-b border-[var(--border)] backdrop-blur-sm px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-2.5">
        <img src="/logo.png" alt="GetThereIE" className="h-8 w-auto" />
        <div className="flex flex-col gap-0.5">
        {points !== null ? (
          <>
            <div className="text-lg font-bold text-[var(--primary)]">
              {points} <span className="text-sm font-semibold text-[var(--muted)]">points</span>
            </div>
            {rank !== null && total !== null && (
              <div className="text-xs text-[var(--muted)]">
                Rank <span className="font-bold text-[var(--foreground)]">#{rank}</span> of {total}
              </div>
            )}
          </>
        ) : (
          <span className="text-sm text-[var(--muted)] animate-pulse">Loading…</span>
        )}
        </div>
      </div>
      <Link href="/leaderboard" className="inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-[var(--border)] transition-colors" aria-label="Leaderboard">
        📊
      </Link>
    </header>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
