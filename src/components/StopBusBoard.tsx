"use client";

import { useEffect, useState, useCallback } from "react";
import RouteCard from "./RouteCard";

interface BusData {
  tripId: string;
  routeId: string;
  stopId: string;
  arrivalTime: string;
  minutesAway: number;
  delayMinutes: number;
  isStopping: boolean;
  occupancyStatus: string | null;
  historicalStopPct: number | null;
}

interface Props {
  stopId: string;
  stopName: string;
  onPointsEarned: () => void;
}

const REFRESH_INTERVAL = 30_000;

export default function StopBusBoard({ stopId, stopName, onPointsEarned }: Props) {
  const [buses, setBuses] = useState<BusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchBuses = useCallback(async () => {
    try {
      const res = await fetch(`/api/buses/${encodeURIComponent(stopId)}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setBuses(data.buses ?? []);
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

  // Group buses by routeId
  const byRoute = buses.reduce<Record<string, BusData[]>>((acc, bus) => {
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

  if (error) {
    return (
      <div className="mx-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div>
      {lastFetch && (
        <p className="text-xs text-gray-400 text-right px-4 mb-2">
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
