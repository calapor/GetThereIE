"use client";

import { useEffect } from "react";

interface Props {
  points: number;
  multiplier: number | null;
  onClose: () => void;
}

export default function PointsAlert({ points, multiplier, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-[var(--card)] rounded-2xl px-8 py-6 shadow-2xl text-center animate-bounce-once cursor-pointer"
        onClick={onClose}
      >
        <div className="text-4xl mb-3">✨</div>
        {multiplier ? (
          <>
            <p className="text-sm text-[var(--muted)] mb-1">You earned</p>
            <p className="text-3xl font-bold text-[var(--accent)]">{points} × {multiplier}</p>
            <p className="text-sm text-[var(--muted)] mt-1">points!</p>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--muted)] mb-1">You earned</p>
            <p className="text-3xl font-bold text-[var(--accent)]">{points} points</p>
          </>
        )}
      </div>
    </div>
  );
}
