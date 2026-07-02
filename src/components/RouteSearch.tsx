"use client";

import { useState, useEffect, useRef } from "react";

export interface RouteResult {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
}

interface Props {
  onSelect: (route: RouteResult) => void;
}

export default function RouteSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RouteResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 1) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/routes/search?q=${encodeURIComponent(query.trim())}`);
      const data: RouteResult[] = await res.json().catch(() => []);
      setResults(data);
      setOpen(data.length > 0);
      setActiveIdx(-1);
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function pick(route: RouteResult) {
    setQuery("");
    setResults([]);
    setOpen(false);
    onSelect(route);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); pick(results[activeIdx]); }
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Route number or destination (e.g. 46A, Harristown)"
        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus
      />
      {open && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.map((route, i) => (
            <li key={route.route_id}>
              <button
                onMouseDown={(e) => { e.preventDefault(); pick(route); }}
                className={`w-full text-left px-4 py-2.5 flex items-baseline gap-2 ${i === activeIdx ? "bg-blue-50" : "hover:bg-gray-50"}`}
              >
                <span className="text-sm font-bold text-blue-700 w-10 shrink-0">{route.route_short_name}</span>
                <span className="text-sm text-gray-700 truncate">{route.route_long_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
