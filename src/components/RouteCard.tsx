"use client";

import { useState, useCallback } from "react";
import BusRow from "./BusRow";
import ThumbButtons from "./ThumbButtons";
import PredictionPills from "./PredictionPills";
import ModeIcon, { luasLineColour } from "./ModeIcon";
import { getStoredUser, updateStoredPoints, clearStoredUser } from "@/lib/user";
import { useToast } from "./Toast";

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
  isScheduled?: boolean;
  stopProbability?: number | null;
  onTimeProbability?: number | null;
  fullnessProbability?: number | null;
  predictionFactors?: string[];
  predictionSampleCount?: number;
}

interface Props {
  routeId: string;
  stopId: string;
  stopName: string;
  buses: BusData[];
  onPointsEarned: () => void;
  onUserNotFound?: () => void;
}

type VoteType = "STOPPED" | "ON_TIME" | "FULL";

export default function RouteCard({ routeId, stopId, buses, onPointsEarned, onUserNotFound }: Props) {
  const [votes, setVotes] = useState<Map<string, boolean>>(new Map());
  const { showToast } = useToast();

  const latestBus = buses[0];
  const shortName = buses[0]?.routeShortName || routeId;
  const luasColour = luasLineColour(shortName);
  const mode = luasColour ? "luas" : "bus";
  const badgeColour = luasColour ?? "var(--primary)";
  const badgeBg = luasColour ? `${luasColour}1a` : "var(--primary-tint)";

  function voteKey(tripId: string, type: VoteType) {
    return `${tripId}:${type}`;
  }

  const handleVote = useCallback(
    async (tripId: string, type: VoteType, vote: boolean) => {
      const key = voteKey(tripId, type);
      if (votes.has(key)) return;

      const user = getStoredUser();
      if (!user) return;

      setVotes((prev) => new Map(prev).set(key, vote));

      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, stopId, routeId, tripId, type, vote }),
      });

      if (res.status === 404) {
        const data = await res.json().catch(() => ({})) as { userNotFound?: boolean };
        if (data.userNotFound) {
          clearStoredUser();
          onUserNotFound?.();
          return;
        }
      }

      if (res.ok) {
        const data = await res.json() as { awarded: number; multiplier: number | null; totalPoints: number };
        if (data.awarded > 0) {
          showToast("Observation recorded ✓");
          updateStoredPoints(data.totalPoints);
          onPointsEarned();
        }
      }
    },
    [votes, stopId, routeId, onPointsEarned, onUserNotFound, showToast]
  );

  const hasPredictions =
    latestBus?.stopProbability != null ||
    latestBus?.onTimeProbability != null ||
    latestBus?.fullnessProbability != null;

  return (
    <div className="card overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
      <div className="bg-gradient-to-r from-[var(--primary)]/5 to-transparent px-4 py-3 border-b border-[var(--border)] flex items-center gap-3">
        <ModeIcon mode={mode} shortName={shortName} size={30} className="shrink-0" />
        <span
          className="font-bold text-lg w-12 h-10 flex items-center justify-center rounded-lg"
          style={{ color: badgeColour, background: badgeBg }}
        >
          {shortName || routeId}
        </span>
        {buses[0]?.headsign && (
          <span className="text-sm text-[var(--foreground)] font-medium truncate">→ {buses[0].headsign}</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--background)]">
              <th className="py-2 px-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Scheduled</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Expected</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {buses.slice(0, 3).map((bus) => (
              <BusRow key={bus.tripId} bus={bus} />
            ))}
            {buses.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-sm text-[var(--muted)]">
                  No buses found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {latestBus && hasPredictions && (
        <PredictionPills
          stopProbability={latestBus.stopProbability ?? 0.7}
          onTimeProbability={latestBus.onTimeProbability ?? 0.6}
          fullnessProbability={latestBus.fullnessProbability ?? 0.3}
          predictionFactors={latestBus.predictionFactors ?? []}
          predictionSampleCount={latestBus.predictionSampleCount ?? 0}
          routeId={routeId}
          stopId={stopId}
        />
      )}

      {latestBus && (
        <div className="px-4 py-3 bg-[var(--background)] border-t border-[var(--border)] flex items-center gap-4 flex-wrap">
          <ThumbButtons
            label="Stopped?"
            voted={votes.has(voteKey(latestBus.tripId, "STOPPED"))
              ? votes.get(voteKey(latestBus.tripId, "STOPPED"))!
              : null}
            onVote={(v) => handleVote(latestBus.tripId, "STOPPED", v)}
          />
          <ThumbButtons
            label="On time?"
            voted={votes.has(voteKey(latestBus.tripId, "ON_TIME"))
              ? votes.get(voteKey(latestBus.tripId, "ON_TIME"))!
              : null}
            onVote={(v) => handleVote(latestBus.tripId, "ON_TIME", v)}
          />
          <ThumbButtons
            label="Full?"
            voted={votes.has(voteKey(latestBus.tripId, "FULL"))
              ? votes.get(voteKey(latestBus.tripId, "FULL"))!
              : null}
            onVote={(v) => handleVote(latestBus.tripId, "FULL", v)}
          />
        </div>
      )}
    </div>
  );
}
