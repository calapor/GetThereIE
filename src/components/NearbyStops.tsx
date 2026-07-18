"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import ModeIcon from "./ModeIcon";

interface NearbyStop {
  stop_id: string;
  stop_name: string;
  distanceMeters?: number;
  mode?: "bus" | "luas";
}

function fmtDistance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

export default function NearbyStops() {
  const [stops, setStops] = useState<NearbyStop[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`/api/stops/nearby?lat=${latitude}&lon=${longitude}`);
          const data: NearbyStop[] = await res.json().catch(() => []);
          setStops(Array.isArray(data) ? data : []);
        } catch {
          setError("Couldn't load nearby stops.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setError("Couldn't get your location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, []);

  // Ask for location as soon as the tab opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    locate();
  }, [locate]);

  if (locating && !stops) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--muted)]">Finding stops near you…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-sm text-[var(--muted)]">{error}</p>
        <button
          onClick={locate}
          className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (stops && stops.length === 0) {
    return <p className="text-center text-[var(--muted)] py-12 text-sm">No stops found near you.</p>;
  }

  return (
    <div className="flex flex-col gap-2 animate-fade-in">
      {stops?.map((s) => (
        <Link
          key={s.stop_id}
          href={`/stop/${encodeURIComponent(s.stop_id)}`}
          className="card flex items-center gap-3 px-4 py-3.5 active:scale-95 transition-transform"
        >
          <ModeIcon mode={s.mode ?? "bus"} className="shrink-0" />
          <span className="flex-1 text-sm font-medium text-[var(--foreground)] truncate">{s.stop_name}</span>
          {s.distanceMeters != null && (
            <span className="text-xs text-[var(--muted)] shrink-0">{fmtDistance(s.distanceMeters)}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
