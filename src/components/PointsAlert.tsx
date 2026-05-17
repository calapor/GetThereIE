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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="bg-white rounded-2xl px-10 py-8 shadow-2xl text-center animate-bounce-once"
        onClick={onClose}
      >
        <p className="text-lg font-semibold text-gray-800 mb-1">Alert</p>
        {multiplier ? (
          <p className="text-2xl font-bold text-green-600">You {multiplier}x points!</p>
        ) : (
          <p className="text-2xl font-bold text-green-600">You earned {points} points!</p>
        )}
      </div>
    </div>
  );
}
