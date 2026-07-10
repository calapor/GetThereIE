"use client";

import { useState, useEffect, useCallback } from "react";
import { getStoredUser } from "@/lib/user";
import UsernamePrompt from "@/components/UsernamePrompt";
import SearchFilter from "@/components/SearchFilter";
import PointsHeader from "@/components/PointsHeader";

export default function Home() {
  const [needsUsername, setNeedsUsername] = useState(false);
  const [ready, setReady] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!getStoredUser()) setNeedsUsername(true);
    setReady(true);
  }, []);

  const handlePointsEarned = useCallback(() => setRefreshTrigger((n) => n + 1), []);

  if (!ready) return null;
  if (needsUsername) return <UsernamePrompt onDone={() => setNeedsUsername(false)} />;

  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      <PointsHeader refreshTrigger={refreshTrigger} />

      <main className="flex-1 flex flex-col px-4 py-8 gap-6">
        <p className="text-center text-[var(--muted)] text-sm">Real-time tracking for buses and Luas • Powered by NTA</p>

        <SearchFilter onPointsEarned={handlePointsEarned} />
      </main>
    </div>
  );
}
