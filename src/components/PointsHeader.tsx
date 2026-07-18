"use client";

import { useEffect, useState } from "react";
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPoints(user.points || Math.floor(Math.random() * 500) + 50);
    setRank(Math.floor(Math.random() * 1000) + 1);
    setTotal(1500);
  }, [refreshTrigger]);

  return (
    <header className="app-header sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-3">
      <img src="/logo-rect.png" alt="GetThereIE" className="h-20 w-auto shrink-0" />
      <div className="flex flex-col items-end gap-0.5 text-right">
        {points !== null ? (
          <>
            <div className="text-lg font-bold text-[var(--primary)] leading-none">
              {points} <span className="text-sm font-semibold text-[var(--muted)]">pts</span>
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
    </header>
  );
}

