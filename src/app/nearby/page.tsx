"use client";

import PointsHeader from "@/components/PointsHeader";
import NearbyStops from "@/components/NearbyStops";

export default function NearbyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      <PointsHeader />
      <main className="flex-1 px-4 py-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">Stops near you</h1>
        <p className="text-sm text-[var(--muted)] mb-5">Bus &amp; Luas stops closest to your location</p>
        <NearbyStops />
      </main>
    </div>
  );
}
