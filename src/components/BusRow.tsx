interface BusRowData {
  arrivalTime: string;
  scheduledTime: string;
  minutesAway: number;
  delayMinutes: number;
  isStopping: boolean;
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

  const delayColorClass = onTime
    ? "text-[var(--accent)]"
    : isLate
    ? "text-[var(--destructive)]"
    : "text-[var(--warning)]";

  return (
    <tr className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)] transition-colors">
      <td className="py-3 px-3">
        <span className="text-sm font-medium text-[var(--foreground)]">{bus.scheduledTime}</span>
      </td>
      <td className="py-3 px-3">
        {bus.isScheduled ? (
          <div>
            <span className="text-sm font-bold text-[var(--muted)]">{bus.arrivalTime}</span>
            {bus.minutesAway <= 60 && (
              <span className="block text-xs text-[var(--muted)] font-medium mt-0.5">
                {formatCountdown(bus.minutesAway)}
              </span>
            )}
          </div>
        ) : (
          <div>
            <span className={`text-sm font-bold ${onTime ? "text-[var(--foreground)]" : delayColorClass}`}>
              {bus.arrivalTime}
            </span>
            {bus.minutesAway <= 60 && (
              <span className="block text-xs text-[var(--muted)] font-medium mt-0.5">
                {formatCountdown(bus.minutesAway)}
              </span>
            )}
          </div>
        )}
      </td>
      <td className={`py-3 px-3 text-xs font-semibold ${delayColorClass}`}>
        {bus.isScheduled ? <span className="text-[var(--muted)]">—</span> : delayLabel}
      </td>
    </tr>
  );
}
