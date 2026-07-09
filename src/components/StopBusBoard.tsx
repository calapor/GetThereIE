"use client";

import { useEffect, useState, useCallback } from "react";
import RouteCard from "./RouteCard";

interface BusData {
  tripId: string;
  routeId: string;
  routeShortName: string;
  headsign: string;
  stopId: string;
  arrivalTime: string;
  scheduledTime: string;
  minutesAway: number;
  delayMinutes: number;
  isStopping: boolean;
  occupancyStatus: string | null;
  historicalStopPct: number | null;
  isScheduled?: boolean;
}

interface Props {
  stopId: string;
  onPointsEarned: () => void;
  // When set, only show buses whose route short name matches (faceted filter).
  routeFilter?: string;
  // Suppress the stop-name header (e.g. when a chip above already shows it).
  hideHeader?: boolean;
  // Reports the distinct route short names currently arriving, so a parent can
  // offer route-narrowing pills (stop-first faceted flow).
  onRoutesAvailable?: (routeShortNames: string[]) => void;
}

const REFRESH_INTERVAL = 30_000;

export default function StopBusBoard({ stopId, onPointsEarned, routeFilter, hideHeader, onRoutesAvailable }: Props) {
  const [buses, setBuses] = useState<BusData[]>([]);
  const [stopName, setStopName] = useState<string>(stopId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchBuses = useCallback(async () => {
    try {
      const res = await fetch(`/api/buses/${encodeURIComponent(stopId)}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setBuses(data.buses ?? []);
      if (data.stopName) setStopName(data.stopName);
      setLastFetch(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch buses");
    } finally {
      setLoading(false);
    }
  }, [stopId]);

  useEffect(() => {
    fetchBuses();
    const id = setInterval(fetchBuses, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchBuses]);

  // Report the distinct routes currently arriving so a parent can offer
  // route-narrowing pills. Keyed on a stable signature to avoid loops.
  const routeSignature = buses.map((b) => b.routeShortName).join(",");
  useEffect(() => {
    if (!onRoutesAvailable) return;
    const seen = new Set<string>();
    const names: string[] = [];
    for (const b of buses) {
      if (!seen.has(b.routeShortName)) {
        seen.add(b.routeShortName);
        names.push(b.routeShortName);
      }
    }
    onRoutesAvailable(names);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSignature]);

  // Optionally narrow to a single route (faceted filter), then group by routeId
  const visibleBuses = routeFilter
    ? buses.filter((b) => b.routeShortName === routeFilter)
    : buses;
  const byRoute = visibleBuses.reduce<Record<string, BusData[]>>((acc, bus) => {
    if (!acc[bus.routeId]) acc[bus.routeId] = [];
    acc[bus.routeId].push(bus);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Only show the hard error box on the very first load (no data yet). If we've
  // already shown buses, a transient refresh failure keeps the last-known board.
  if (error && !lastFetch) {
    return (
      <div className="p-4 bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 rounded-lg text-sm text-[var(--destructive)]">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{stopName}</h1>
          <p className="text-xs text-[var(--muted)]">{stopId}</p>
        </div>
      )}
      {lastFetch && (
        <div className="flex items-center justify-between px-2 py-1">
          <p className="text-xs text-[var(--muted)]">
            {error ? (
              <span className="text-[var(--warning)]">Refresh failed • </span>
            ) : null}
            Updated {lastFetch.toLocaleTimeString()}
          </p>
          <button
            onClick={() => { setLoading(true); fetchBuses(); }}
            className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-dark)] transition-colors"
          >
            Refresh
          </button>
        </div>
      )}
      <div className="space-y-3">
        {Object.entries(byRoute).map(([routeId, routeBuses]) => (
          <RouteCard
            key={routeId}
            routeId={routeId}
            stopId={stopId}
            stopName={stopName}
            buses={routeBuses}
            onPointsEarned={onPointsEarned}
          />
        ))}
        {Object.keys(byRoute).length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--muted)] text-sm">No upcoming buses at this stop</p>
          </div>
        )}
      </div>
    </div>
  );
}
