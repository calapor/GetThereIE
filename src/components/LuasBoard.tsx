"use client";

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
}

function DueLabel({ minutes }: { minutes: number }) {
  return (
    <span className="text-sm font-bold tabular-nums">
      {minutes === 0 ? "DUE" : `${minutes} min`}
    </span>
  );
}

// Dedicated Luas board styled like a platform sign: two direction columns with
// the destination and due-time for each tram. directionId 1 = Inbound, 0 = Outbound.
export default function LuasBoard({ line, buses }: Props) {
  const colour = luasLineColour(line) ?? "var(--primary)";
  const inbound = buses.filter((b) => b.directionId === 1);
  const outbound = buses.filter((b) => b.directionId === 0);

  const Column = ({ title, trams }: { title: string; trams: BusData[] }) => (
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
              <DueLabel minutes={t.minutesAway} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="card p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-3 h-3 rounded-full" style={{ background: colour }} />
        <span className="text-sm font-bold text-[var(--foreground)]">Luas {line} Line</span>
      </div>
      <div className="flex gap-3">
        <Column title="Inbound" trams={inbound} />
        <Column title="Outbound" trams={outbound} />
      </div>
    </div>
  );
}
