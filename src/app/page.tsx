"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/user";
import UsernamePrompt from "@/components/UsernamePrompt";

const RECENT_KEY = "busTrackerRecent";

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecent(stopId: string) {
  const prev = getRecent().filter((s) => s !== stopId);
  localStorage.setItem(RECENT_KEY, JSON.stringify([stopId, ...prev].slice(0, 5)));
}

export default function Home() {
  const router = useRouter();
  const [needsUsername, setNeedsUsername] = useState(false);
  const [stopId, setStopId] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredUser()) setNeedsUsername(true);
    setRecent(getRecent());
    setReady(true);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = stopId.trim();
    if (!id) return;
    saveRecent(id);
    router.push(`/stop/${encodeURIComponent(id)}`);
  }

  function goToStop(id: string) {
    saveRecent(id);
    router.push(`/stop/${encodeURIComponent(id)}`);
  }

  if (!ready) return null;

  if (needsUsername) {
    return <UsernamePrompt onDone={() => setNeedsUsername(false)} />;
  }

  return (
    <main className="flex flex-col min-h-screen px-4 pt-16">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">🚌 Bus Tracker</h1>
      <p className="text-center text-sm text-gray-500 mb-8">Ireland — powered by NTA real-time data</p>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
        <input
          type="text"
          value={stopId}
          onChange={(e) => setStopId(e.target.value)}
          placeholder="Stop ID (e.g. 8220DB000004)"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white rounded-lg px-5 py-3 font-semibold text-base disabled:opacity-50"
          disabled={!stopId.trim()}
        >
          Go
        </button>
      </form>

      {recent.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent stops</p>
          <div className="flex flex-col gap-2">
            {recent.map((id) => (
              <button
                key={id}
                onClick={() => goToStop(id)}
                className="text-left px-4 py-3 border border-gray-200 rounded-lg text-sm text-blue-600 font-medium hover:bg-gray-50 active:bg-gray-100"
              >
                Stop {id}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
