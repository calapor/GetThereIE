"use client";

export type Mode = "bus" | "luas";

// Detects a Luas line from a route short name (e.g. "Red", "Green").
export function luasLineColour(shortName?: string): string | null {
  if (!shortName) return null;
  const s = shortName.trim().toLowerCase();
  if (s === "red" || s.includes("luas red")) return "#e11d2a";
  if (s === "green" || s.includes("luas green")) return "#16a34a";
  return null;
}

interface Props {
  mode: Mode;
  shortName?: string;
  className?: string;
  size?: number;
}

// A small circular badge holding a bus or tram glyph. For Luas it tints with the
// line colour (Red/Green); buses use the brand blue.
export default function ModeIcon({ mode, shortName, className = "", size = 34 }: Props) {
  const luasColour = mode === "luas" ? luasLineColour(shortName) ?? "#6b7280" : null;
  const tint = luasColour ?? "var(--primary)";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: luasColour ? `${luasColour}1a` : "var(--primary-tint)",
        color: tint,
      }}
      aria-hidden
    >
      {mode === "luas" ? (
        // Tram
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ width: size * 0.55, height: size * 0.55 }}>
          <rect x="5" y="3" width="14" height="14" rx="2.5" />
          <path d="M5 10h14" />
          <path d="M12 3v3" />
          <path d="M8 21l2-4" />
          <path d="M16 21l-2-4" />
          <circle cx="8.5" cy="13.5" r="0.6" fill="currentColor" />
          <circle cx="15.5" cy="13.5" r="0.6" fill="currentColor" />
        </svg>
      ) : (
        // Bus
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ width: size * 0.55, height: size * 0.55 }}>
          <path d="M4 6.5C4 4.5 7 4 12 4s8 .5 8 2.5V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5Z" />
          <path d="M4 11h16" />
          <path d="M7 18v2" />
          <path d="M17 18v2" />
          <circle cx="8" cy="14.5" r="0.6" fill="currentColor" />
          <circle cx="16" cy="14.5" r="0.6" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}
