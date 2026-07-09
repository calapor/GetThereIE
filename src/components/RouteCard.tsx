"use client";

import { useState, useCallback } from "react";
import BusRow from "./BusRow";
import ThumbButtons from "./ThumbButtons";
import PointsAlert from "./PointsAlert";
import { getStoredUser, updateStoredPoints } from "@/lib/user";

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
  routeId: string;
  stopId: string;
  stopName: string;
  buses: BusData[];
  onPointsEarned: () => void;
}

interface VoteKey {
  tripId: string;
  type: "STOPPED" | "ON_TIME";
}

interface AlertState {
  points: number;
  multiplier: number | null;
}

export default function RouteCard({ routeId, stopId, stopName, buses, onPointsEarned }: Props) {
  const [votes, setVotes] = useState<Map<string, boolean>>(new Map());
  const [alert, setAlert] = useState<AlertState | null>(null);

  const latestBus = buses[0];

  function voteKey({ tripId, type }: VoteKey) {
    return `${tripId}:${type}`;
  }

  const handleVote = useCallback(
    async (tripId: string, type: "STOPPED" | "ON_TIME", vote: boolean) => {
      const key = voteKey({ tripId, type });
      if (votes.has(key)) return;

      const user = getStoredUser();
      if (!user) return;

      setVotes((prev) => new Map(prev).set(key, vote));

      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, stopId, routeId, tripId, type, vote }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.awarded > 0) {
          setAlert({ points: data.awarded, multiplier: data.multiplier });
          updateStoredPoints(data.totalPoints);
          onPointsEarned();
        }
      }
    },
    [votes, stopId, routeId, onPointsEarned]
  );

  const dismissAlert = useCallback(() => setAlert(null), []);

  return (
    <>
      {alert && (
        <PointsAlert points={alert.points} multiplier={alert.multiplier} onClose={dismissAlert} />
      )}
      <div className="border border-gray-300 rounded-lg mb-4 overflow-hidden">
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-300 flex items-baseline gap-2">
          <span className="font-bold text-sm text-blue-700 shrink-0">
            {buses[0]?.routeShortName || routeId}
          </span>
          {buses[0]?.headsign && (
            <span className="text-sm text-gray-700">→ {buses[0].headsign}</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-white">
                <th className="py-1.5 px-2 text-left text-xs font-semibold text-gray-500">Scheduled</th>
                <th className="py-1.5 px-2 text-left text-xs font-semibold text-gray-500">Expected</th>
                <th className="py-1.5 px-2 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="py-1.5 px-2 text-left text-xs font-semibold text-gray-500">Fullness</th>
                <th className="py-1.5 px-2 text-left text-xs font-semibold text-gray-500">Historical</th>
              </tr>
            </thead>
            <tbody>
              {buses.slice(0, 3).map((bus) => (
                <BusRow key={bus.tripId} bus={bus} />
              ))}
              {buses.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-sm text-gray-400">
                    No buses found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {latestBus && (
          <div className="px-3 py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-4">
            <ThumbButtons
              label="Stopped?"
              voted={votes.has(voteKey({ tripId: latestBus.tripId, type: "STOPPED" }))
                ? votes.get(voteKey({ tripId: latestBus.tripId, type: "STOPPED" }))!
                : null}
              onVote={(v) => handleVote(latestBus.tripId, "STOPPED", v)}
            />
            <ThumbButtons
              label="Arrived on time?"
              voted={votes.has(voteKey({ tripId: latestBus.tripId, type: "ON_TIME" }))
                ? votes.get(voteKey({ tripId: latestBus.tripId, type: "ON_TIME" }))!
                : null}
              onVote={(v) => handleVote(latestBus.tripId, "ON_TIME", v)}
            />
          </div>
        )}
      </div>
    </>
  );
}
