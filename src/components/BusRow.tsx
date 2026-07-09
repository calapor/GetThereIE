interface BusRowData {
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
  bus: BusRowData;
}

function formatCountdown(minutesAway: number): string {
  if (minutesAway === 0) return "DUE";
  if (minutesAway <= 60) return `${minutesAway} min`;
  return "";
}

function formatOccupancy(status: string | null): string {
  if (!status) return "—";
  const map: Record<string, string> = {
    EMPTY: "0%",
    MANY_SEATS_AVAILABLE: "25%",
    FEW_SEATS_AVAILABLE: "60%",
    STANDING_ROOM_ONLY: "80%",
    CRUSHED_STANDING_ROOM_ONLY: "100%",
    FULL: "100%",
    NOT_ACCEPTING_PASSENGERS: "Full",
  };
  return map[status] ?? "—";
}

function formatHistorical(pct: number | null): string {
  if (pct === null) return "—";
  return pct >= 70 ? "Stopping" : pct <= 30 ? "Not stopping" : "Sometimes";
}

export default function BusRow({ bus }: Props) {
  const isLate = bus.delayMinutes > 1;
  const isEarly = bus.delayMinutes < -1;
  const onTime = !isLate && !isEarly;

  const delayLabel = bus.isScheduled
    ? "Scheduled"
    : onTime
    ? "On time"
    : isLate
    ? `+${bus.delayMinutes} min late`
    : `${Math.abs(bus.delayMinutes)} min early`;

  const delayColor = bus.isScheduled
    ? "text-gray-400"
    : onTime ? "text-green-600" : isLate ? "text-red-500" : "text-yellow-600";

  const delayColorClass = onTime ? "text-[var(--accent)]" : isLate ? "text-[var(--destructive)]" : "text-[var(--warning)]";

  return (
    <tr className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)] transition-colors">
      {/* Scheduled time */}
      <td className="py-3 px-3">
        <span className="text-sm font-medium text-[var(--foreground)]">{bus.scheduledTime}</span>
      </td>

      {/* Real-time ETA */}
      <td className="py-3 px-3">
        {bus.isScheduled ? (
          <div>
            <span className="text-sm font-bold text-[var(--muted)]">{bus.arrivalTime}</span>
            {bus.minutesAway <= 60 && (
              <span className="block text-xs text-[var(--muted)] font-medium mt-0.5">{formatCountdown(bus.minutesAway)}</span>
            )}
          </div>
        ) : (
          <div>
            <span className={`text-sm font-bold ${onTime ? "text-[var(--foreground)]" : delayColorClass}`}>
              {bus.arrivalTime}
            </span>
            {bus.minutesAway <= 60 && (
              <span className="block text-xs text-[var(--muted)] font-medium mt-0.5">{formatCountdown(bus.minutesAway)}</span>
            )}
          </div>
        )}
      </td>

      {/* Delay */}
      <td className={`py-3 px-3 text-xs font-semibold ${delayColorClass}`}>
        {bus.isScheduled ? <span className="text-[var(--muted)]">—</span> : delayLabel}
      </td>

      {/* Occupancy */}
      <td className="py-3 px-3 text-sm text-[var(--muted)]">
        {formatOccupancy(bus.occupancyStatus)}
      </td>

      {/* Historical (user votes) */}
      <td className="py-3 px-3 text-sm text-[var(--muted)]">
        {formatHistorical(bus.historicalStopPct)}
      </td>
    </tr>
  );
}
