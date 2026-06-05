"use client";

import { useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import PointsHeader from "@/components/PointsHeader";
import StopBusBoard from "@/components/StopBusBoard";

interface Props {
  params: Promise<{ stopId: string }>;
}

export default function StopPage({ params }: Props) {
  const { stopId } = use(params);
  const router = useRouter();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handlePointsEarned = useCallback(() => {
    setRefreshTrigger((n) => n + 1);
  }, []);

  const decodedId = decodeURIComponent(stopId);

  return (
    <div className="flex flex-col min-h-screen">
      <PointsHeader refreshTrigger={refreshTrigger} />

      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button
          onClick={() => router.back()}
          className="text-blue-600 text-sm font-medium"
          aria-label="Go back"
        >
          ← Back
        </button>
        <span className="text-sm text-gray-500">Stop {decodedId}</span>
      </div>

      <div className="flex-1 px-4 py-4">
        <StopBusBoard
          stopId={decodedId}
          stopName={decodedId}
          onPointsEarned={handlePointsEarned}
        />
      </div>
    </div>
  );
}
