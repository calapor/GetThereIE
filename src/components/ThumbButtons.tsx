"use client";

interface Props {
  label: string;
  voted: boolean | null; // null = not voted, true = thumbs up, false = thumbs down
  onVote: (vote: boolean) => void;
  disabled?: boolean;
}

export default function ThumbButtons({ label, voted, onVote, disabled }: Props) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 font-medium">{label}</span>
      <button
        onClick={() => onVote(true)}
        disabled={disabled || voted !== null}
        className={`text-2xl transition-transform active:scale-90 disabled:opacity-40 ${
          voted === true ? "opacity-100" : "opacity-60 hover:opacity-100"
        }`}
        aria-label="Thumbs up"
      >
        👍
      </button>
      <button
        onClick={() => onVote(false)}
        disabled={disabled || voted !== null}
        className={`text-2xl transition-transform active:scale-90 disabled:opacity-40 ${
          voted === false ? "opacity-100" : "opacity-60 hover:opacity-100"
        }`}
        aria-label="Thumbs down"
      >
        👎
      </button>
    </div>
  );
}
