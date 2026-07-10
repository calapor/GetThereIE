"use client";

interface Props {
  label: string;
  voted: boolean | null; // null = not voted, true = thumbs up, false = thumbs down
  onVote: (vote: boolean) => void;
  disabled?: boolean;
}

export default function ThumbButtons({ label, voted, onVote, disabled }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--foreground)] font-medium whitespace-nowrap">{label}</span>
      <button
        onClick={() => onVote(true)}
        disabled={disabled || voted !== null}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-90 disabled:opacity-30 ${
          voted === true ? "bg-[var(--accent)]/20 opacity-100" : "opacity-50 hover:opacity-100 hover:bg-[var(--primary)]/10"
        }`}
        aria-label="Thumbs up"
      >
        <span className="text-base">👍</span>
      </button>
      <button
        onClick={() => onVote(false)}
        disabled={disabled || voted !== null}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-90 disabled:opacity-30 ${
          voted === false ? "bg-[var(--destructive)]/20 opacity-100" : "opacity-50 hover:opacity-100 hover:bg-[var(--destructive)]/10"
        }`}
        aria-label="Thumbs down"
      >
        <span className="text-base">👎</span>
      </button>
    </div>
  );
}
