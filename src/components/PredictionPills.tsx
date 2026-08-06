"use client";

import { useState } from "react";

interface Props {
  stopProbability: number;
  onTimeProbability: number;
  fullnessProbability: number;
  predictionFactors: string[];
  predictionSampleCount: number;
  routeId: string;
  stopId: string;
}

function pillColor(prob: number): string {
  if (prob >= 0.7) return "var(--accent)";
  if (prob >= 0.4) return "var(--warning)";
  return "var(--destructive)";
}

function pct(prob: number): string {
  return `${Math.round(prob * 100)}%`;
}

export default function PredictionPills({
  stopProbability,
  onTimeProbability,
  fullnessProbability,
  predictionFactors,
  predictionSampleCount,
  routeId,
  stopId,
}: Props) {
  const [narration, setNarration] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function toggleNarration() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (narration) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        routeId,
        stopId,
        factors: predictionFactors.join(","),
        stopP: stopProbability.toString(),
        onTimeP: onTimeProbability.toString(),
        fullP: fullnessProbability.toString(),
      });
      const res = await fetch(`/api/predict/narration?${params}`);
      if (res.ok) {
        const data = await res.json() as { text: string };
        setNarration(data.text);
      }
    } finally {
      setLoading(false);
    }
  }

  const pills = [
    { label: "Stops here", prob: stopProbability },
    { label: "On time", prob: onTimeProbability },
    { label: "Fullness", prob: fullnessProbability },
  ];

  return (
    <div className="px-4 py-2 border-t border-[var(--border)]">
      <div className="flex gap-2 mb-1">
        {pills.map(({ label, prob }) => (
          <div
            key={label}
            className="flex-1 text-center rounded-lg py-1.5 px-1"
            style={{ background: `color-mix(in srgb, ${pillColor(prob)} 12%, transparent)` }}
          >
            <div className="text-sm font-bold" style={{ color: pillColor(prob) }}>
              {pct(prob)}
            </div>
            <div className="text-[10px] text-[var(--muted)] leading-tight">{label}</div>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-[var(--muted)] text-center leading-relaxed">
        {predictionSampleCount > 0
          ? `based on ${predictionSampleCount} observation${predictionSampleCount !== 1 ? "s" : ""}`
          : "no observations yet"}
        {predictionFactors.length > 0 && ` · ${predictionFactors.join(" · ")}`}
      </div>
      <button
        onClick={toggleNarration}
        className="mt-0.5 text-[10px] text-[var(--primary)] hover:underline w-full text-center"
      >
        {open ? "Hide" : "Why?"}
      </button>
      {open && (
        <div className="mt-1 text-xs text-[var(--foreground)] text-center px-2 animate-fade-in">
          {loading ? <span className="text-[var(--muted)] animate-pulse">Loading…</span> : (narration ?? "Unable to load explanation")}
        </div>
      )}
    </div>
  );
}
