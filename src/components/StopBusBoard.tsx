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
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Only show the hard error box on the very first load (no data yet). If we've
  // already shown buses, a transient refresh failure keeps the last-known board.
  if (error && !lastFetch) {
    return (
      <div className="mx-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div>
      {!hideHeader && (
        <>
          <h1 className="text-xl font-bold text-gray-900 mb-1">{stopName}</h1>
          <p className="text-xs text-gray-400 mb-3">{stopId}</p>
        </>
      )}
      {lastFetch && (
        <p className="text-xs text-gray-400 text-right px-4 mb-2">
          {error ? (
            <span className="text-amber-500">Couldn&apos;t refresh · </span>
          ) : null}
          Updated {lastFetch.toLocaleTimeString()}
        </p>
      )}
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
        <p className="text-center text-gray-400 py-8 text-sm">
          No upcoming buses at this stop.
        </p>
      )}
    </div>
  );
}
