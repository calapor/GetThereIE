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
    <div className="flex flex-col min-h-screen">
      <PointsHeader refreshTrigger={refreshTrigger} />

      <main className="flex flex-col px-4 pt-10">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-1">🚌 Bus Tracker</h1>
        <p className="text-center text-sm text-gray-500 mb-8">Ireland — powered by NTA real-time data</p>

        <SearchFilter onPointsEarned={handlePointsEarned} />
      </main>
    </div>
  );
}
