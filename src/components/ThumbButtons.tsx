"use client";

interface Props {
  label: string;
  voted: boolean | null; // null = not voted, true = thumbs up, false = thumbs down
  onVote: (vote: boolean) => void;
  disabled?: boolean;
}

export default function ThumbButtons({ label, voted, onVote, disabled }: Props) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-[var(--foreground)] font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onVote(true)}
          disabled={disabled || voted !== null}
          className={`inline-flex items-center justify-center w-10 h-10 rounded-lg transition-all active:scale-90 disabled:opacity-30 ${
            voted === true ? "bg-[var(--accent)]/20 opacity-100" : "opacity-50 hover:opacity-100 hover:bg-[var(--primary)]/10"
          }`}
          aria-label="Thumbs up"
        >
          <span className="text-xl">👍</span>
        </button>
        <button
          onClick={() => onVote(false)}
          disabled={disabled || voted !== null}
          className={`inline-flex items-center justify-center w-10 h-10 rounded-lg transition-all active:scale-90 disabled:opacity-30 ${
            voted === false ? "bg-[var(--destructive)]/20 opacity-100" : "opacity-50 hover:opacity-100 hover:bg-[var(--destructive)]/10"
          }`}
          aria-label="Thumbs down"
        >
          <span className="text-xl">👎</span>
        </button>
      </div>
    </div>
  );
}
