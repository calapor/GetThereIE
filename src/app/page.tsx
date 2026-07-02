"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/user";
import UsernamePrompt from "@/components/UsernamePrompt";
import RouteSearch, { RouteResult } from "@/components/RouteSearch";
import RouteStopSearch from "@/components/RouteStopSearch";
import PointsHeader from "@/components/PointsHeader";

const RECENT_KEY = "busTrackerRecentV2";

interface RecentStop {
  id: string;
  name: string;
}

function getRecent(): RecentStop[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); }
  catch { return []; }
}

function saveRecent(stop: RecentStop) {
  const prev = getRecent().filter((s) => s.id !== stop.id);
  localStorage.setItem(RECENT_KEY, JSON.stringify([stop, ...prev].slice(0, 8)));
}

export default function Home() {
  const router = useRouter();
  const [needsUsername, setNeedsUsername] = useState(false);
  const [recent, setRecent] = useState<RecentStop[]>([]);
  const [ready, setReady] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteResult | null>(null);

  useEffect(() => {
    if (!getStoredUser()) setNeedsUsername(true);
    setRecent(getRecent());
    setReady(true);
  }, []);

  function goToStop(stop: RecentStop) {
    saveRecent(stop);
    setRecent(getRecent());
    router.push(`/stop/${encodeURIComponent(stop.id)}`);
  }

  if (!ready) return null;
  if (needsUsername) return <UsernamePrompt onDone={() => setNeedsUsername(false)} />;

  return (
    <div className="flex flex-col min-h-screen">
      <PointsHeader refreshTrigger={0} />

      <main className="flex flex-col px-4 pt-10">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-1">🚌 Bus Tracker</h1>
        <p className="text-center text-sm text-gray-500 mb-8">Ireland — powered by NTA real-time data</p>

        {!selectedRoute ? (
          <RouteSearch onSelect={setSelectedRoute} />
        ) : (
          <RouteStopSearch
            route={selectedRoute}
            onBack={() => setSelectedRoute(null)}
            onSelect={(stop) => goToStop({ id: stop.stop_id, name: stop.stop_name })}
          />
        )}

        {!selectedRoute && recent.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent stops</p>
            <div className="flex flex-col gap-2">
              {recent.map((stop) => (
                <button
                  key={stop.id}
                  onClick={() => goToStop(stop)}
                  className="text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 active:bg-gray-100"
                >
                  <span className="text-sm font-medium text-gray-900">{stop.name}</span>
                  <span className="block text-xs text-gray-400">{stop.id}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
