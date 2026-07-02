interface BusRowData {
  arrivalTime: string;
  scheduledTime: string;
  minutesAway: number;
  delayMinutes: number;
  isStopping: boolean;
  occupancyStatus: string | null;
  historicalStopPct: number | null;
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

  const delayLabel = onTime
    ? "On time"
    : isLate
    ? `+${bus.delayMinutes} min late`
    : `${Math.abs(bus.delayMinutes)} min early`;

  const delayColor = onTime ? "text-green-600" : isLate ? "text-red-500" : "text-yellow-600";

  return (
    <tr className="border-b border-gray-100 last:border-0">
      {/* Scheduled time */}
      <td className="py-2 px-2">
        <span className="text-sm font-semibold text-gray-800">{bus.scheduledTime}</span>
      </td>

      {/* Real-time ETA */}
      <td className="py-2 px-2">
        <span className={`text-sm font-semibold ${onTime ? "text-gray-800" : delayColor}`}>
          {bus.arrivalTime}
        </span>
        {bus.minutesAway <= 60 && (
          <span className="block text-xs text-gray-400">{formatCountdown(bus.minutesAway)}</span>
        )}
      </td>

      {/* Delay */}
      <td className={`py-2 px-2 text-xs font-medium ${delayColor}`}>
        {delayLabel}
      </td>

      {/* Occupancy */}
      <td className="py-2 px-2 text-sm text-gray-500">
        {formatOccupancy(bus.occupancyStatus)}
      </td>

      {/* Historical (user votes) */}
      <td className="py-2 px-2 text-sm text-gray-500">
        {formatHistorical(bus.historicalStopPct)}
      </td>
    </tr>
  );
}
