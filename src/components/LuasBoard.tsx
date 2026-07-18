"use client";

import { useEffect, useState } from "react";
import { luasLineColour } from "./ModeIcon";

interface BusData {
  tripId: string;
  routeShortName: string;
  headsign: string;
  directionId?: number;
  minutesAway: number;
}

interface Props {
  line: string; // "Red" | "Green"
  buses: BusData[];
  fetchedAt: Date;
}

function DueLabel({ minutes, fetchedAt }: { minutes: number; fetchedAt: Date }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (minutes > 3) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [minutes]);

  if (minutes === 0) {
    return <span className="text-sm font-bold tabular-nums">DUE</span>;
  }

  if (minutes <= 3) {
    const secsLeft = Math.max(0, minutes * 60 - Math.floor((now - fetchedAt.getTime()) / 1000));
    return (
      <span className="text-right leading-tight">
        <span className="block text-sm font-bold tabular-nums">{minutes} min</span>
        <span className="block text-xs tabular-nums opacity-60">{secsLeft}s</span>
      </span>
    );
  }

  return <span className="text-sm font-bold tabular-nums">{minutes} min</span>;
}

interface ColumnProps {
  title: string;
  trams: BusData[];
  colour: string;
  fetchedAt: Date;
}

function Column({ title, trams, colour, fetchedAt }: ColumnProps) {
  return (
    <div className="flex-1 min-w-0">
      <div
        className="text-xs font-bold uppercase tracking-wider px-3 py-2 text-white rounded-t-lg"
        style={{ background: colour }}
      >
        {title}
      </div>
      <div className="flex flex-col divide-y divide-[var(--border)] border border-t-0 border-[var(--border)] rounded-b-lg">
        {trams.length === 0 && (
          <div className="px-3 py-4 text-xs text-[var(--muted)] text-center">No trams forecast</div>
        )}
        {trams.map((t) => (
          <div key={t.tripId} className="flex items-center justify-between gap-2 px-3 py-2.5">
            <span className="text-sm text-[var(--foreground)] truncate">{t.headsign}</span>
            <span className="shrink-0" style={{ color: colour }}>
              <DueLabel minutes={t.minutesAway} fetchedAt={fetchedAt} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Dedicated Luas board styled like a platform sign: two direction columns with
// the destination and due-time for each tram. directionId 1 = Inbound, 0 = Outbound.
export default function LuasBoard({ line, buses, fetchedAt }: Props) {
  const colour = luasLineColour(line) ?? "var(--primary)";
  const inbound = buses.filter((b) => b.directionId === 1);
  const outbound = buses.filter((b) => b.directionId === 0);

  return (
    <div className="card p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-3 h-3 rounded-full" style={{ background: colour }} />
        <span className="text-sm font-bold text-[var(--foreground)]">Luas {line} Line</span>
      </div>
      <div className="flex gap-3">
        <Column title="Inbound" trams={inbound} colour={colour} fetchedAt={fetchedAt} />
        <Column title="Outbound" trams={outbound} colour={colour} fetchedAt={fetchedAt} />
      </div>
    </div>
  );
}
