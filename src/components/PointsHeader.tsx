"use client";

import { useEffect, useRef, useState } from "react";
import { getStoredUser } from "@/lib/user";

interface Props {
  refreshTrigger?: number;
}

function useCountUp(target: number | null, duration = 600): number | null {
  const [displayed, setDisplayed] = useState<number | null>(target);
  const prevRef = useRef<number | null>(target);

  useEffect(() => {
    if (target === null) { setDisplayed(null); return; }
    const from = prevRef.current ?? target;
    prevRef.current = target;
    if (from === target) { setDisplayed(target); return; }
    const start = performance.now();
    let raf: number;
    function step(now: number) {
      const t = Math.min(1, (now - start) / duration);
      setDisplayed(Math.round(from + (target! - from) * t));
      if (t < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return displayed;
}

export default function PointsHeader({ refreshTrigger }: Props) {
  const [points, setPoints] = useState<number | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) return;
    fetch(`/api/leaderboard?userId=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        setRank(data.myRank ?? null);
        setTotal(data.total ?? null);
      })
      .catch(() => {});
    fetch(`/api/user?id=${user.id}`)
      .then((r) => r.json())
      .then((data) => { if (data.points !== undefined) setPoints(data.points); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  const displayedPoints = useCountUp(points);

  return (
    <header className="app-header sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-3">
      <img src="/logo-rect.png" alt="GetThereIE" className="h-20 w-auto shrink-0" />
      <div className="flex flex-col items-end gap-0.5 text-right">
        {displayedPoints !== null ? (
          <>
            <div className="text-lg font-bold text-[var(--primary)] leading-none">
              {displayedPoints} <span className="text-sm font-semibold text-[var(--muted)]">pts</span>
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
