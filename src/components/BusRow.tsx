interface BusRowData {
  arrivalTime: string;
  minutesAway: number;
  delayMinutes: number;
  isStopping: boolean;
  occupancyStatus: string | null;
  historicalStopPct: number | null;
}

interface Props {
  bus: BusRowData;
}

function formatArriving(minutesAway: number, arrivalTime: string): string {
  if (minutesAway === 0) return "DUE";
  if (minutesAway <= 60) return `${minutesAway} min`;
  return arrivalTime;
}

function formatDelay(delayMinutes: number): string {
  if (Math.abs(delayMinutes) <= 1) return "On time";
  if (delayMinutes > 0) return `+${delayMinutes} min`;
  return `${delayMinutes} min`;
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
  const delayColor =
    bus.delayMinutes <= 1
      ? "text-green-600"
      : bus.delayMinutes <= 4
      ? "text-yellow-600"
      : "text-red-600";

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 px-2 text-sm font-semibold">
        {formatArriving(bus.minutesAway, bus.arrivalTime)}
      </td>
      <td className={`py-2 px-2 text-sm font-medium ${delayColor}`}>
        {formatDelay(bus.delayMinutes)}
      </td>
      <td className="py-2 px-2 text-sm text-gray-500">
        {formatOccupancy(bus.occupancyStatus)}
      </td>
      <td className="py-2 px-2 text-sm">
        <span className={bus.isStopping ? "text-green-600" : "text-red-500"}>
          {bus.isStopping ? "Yes" : "No"}
        </span>
      </td>
      <td className="py-2 px-2 text-sm text-gray-500">
        {formatHistorical(bus.historicalStopPct)}
      </td>
    </tr>
  );
}
