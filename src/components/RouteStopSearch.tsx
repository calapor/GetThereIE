"use client";

import { useState, useEffect, useRef } from "react";
import type { RouteResult } from "./RouteSearch";

export interface StopResult {
  stop_id: string;
  stop_name: string;
}

interface Props {
  route: RouteResult;
  onSelect: (stop: StopResult) => void;
  onBack: () => void;
}

export default function RouteStopSearch({ route, onSelect, onBack }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StopResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [allStops, setAllStops] = useState<StopResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load all stops for the route on mount
  useEffect(() => {
    fetch(`/api/routes/stops?routeId=${encodeURIComponent(route.route_id)}`)
      .then((r) => r.json())
      .then((data: StopResult[]) => {
        setAllStops(data);
        setResults(data);
        setOpen(true);
      })
      .catch(() => {});
  }, [route.route_id]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults(allStops);
      setOpen(allStops.length > 0);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(
        `/api/routes/stops?routeId=${encodeURIComponent(route.route_id)}&q=${encodeURIComponent(query.trim())}`
      );
      const data: StopResult[] = await res.json().catch(() => []);
      setResults(data);
      setOpen(data.length > 0);
      setActiveIdx(-1);
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, route.route_id, allStops]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function pick(stop: StopResult) {
    setOpen(false);
    onSelect(stop);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); pick(results[activeIdx]); }
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-blue-600 text-sm font-medium">← Back</button>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold text-blue-700">{route.route_short_name}</span>
          <span className="text-xs text-gray-500 truncate">{route.route_long_name}</span>
        </div>
      </div>

      <div ref={containerRef} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Filter stops…"
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
        />
        {open && results.length > 0 && (
          <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
            {results.map((stop, i) => (
              <li key={stop.stop_id}>
                <button
                  onMouseDown={(e) => { e.preventDefault(); pick(stop); }}
                  className={`w-full text-left px-4 py-2.5 flex flex-col ${i === activeIdx ? "bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  <span className="text-sm font-medium text-gray-900">{stop.stop_name}</span>
                  <span className="text-xs text-gray-400">{stop.stop_id}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
