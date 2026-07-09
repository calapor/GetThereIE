"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import StopBusBoard from "./StopBusBoard";

interface StopHit {
  stop_id?: string;
  stop_name?: string;
  id?: string;
  name?: string;
  stop_lat?: number | null;
  stop_lon?: number | null;
  lat?: number | null;
  lon?: number | null;
  distanceMeters?: number;
}

interface RouteResult {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  id: string;
  name: string;
  shortName: string;
  headsign: string;
}

interface LiveTrip {
  tripId: string;
  routeShortName: string;
  headsign: string;
  directionId: number;
  nextStopId: string;
  nextStopName: string;
  minutesAway: number;
  delayMinutes: number;
}

interface Props {
  onPointsEarned: () => void;
}

const RECENT_KEY = "busTrackerRecentV2";

function getRecent(): StopHit[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); }
  catch { return []; }
}

function saveRecent(stop: StopHit) {
  const id = stop.stop_id || stop.id;
  const name = stop.stop_name || stop.name;
  const entry = { stop_id: id, stop_name: name, id, name };
  const prev = getRecent().filter((s) => (s.stop_id || s.id) !== id);
  localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...prev].slice(0, 8)));
}

function fmtDistance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

export default function SearchFilter({ onPointsEarned }: Props) {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [stop, setStop] = useState<StopHit | null>(null);
  const [query, setQuery] = useState("");

  // Discovery (nothing selected) state
  const [combined, setCombined] = useState<{ routes: RouteResult[]; stops: StopHit[] }>({ routes: [], stops: [] });
  const [recent, setRecent] = useState<StopHit[]>([]);
  const [nearby, setNearby] = useState<StopHit[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Route-selected state
  const [routeTab, setRouteTab] = useState<"stops" | "live">("stops");
  const [routeStops, setRouteStops] = useState<StopHit[]>([]);
  const [liveTrips, setLiveTrips] = useState<LiveTrip[] | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [directions, setDirections] = useState<{ directionId: number; headsign: string }[]>([]);
  const [selectedDirection, setSelectedDirection] = useState<number | null>(null);

  // Stop-selected state — routes currently arriving, for narrowing pills
  const [availableRoutes, setAvailableRoutes] = useState<string[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setRecent(getRecent()); }, []);

  // Combined typeahead (discovery state)
  useEffect(() => {
    if (route || stop) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 1) { setCombined({ routes: [], stops: [] }); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({ routes: [], stops: [] }));
      setCombined({ routes: data.routes ?? [], stops: data.stops ?? [] });
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, route, stop]);

  // Fetch directions when a route is selected
  useEffect(() => {
    if (!route || stop) return;
    setDirections([]);
    setSelectedDirection(null);
    fetch(`/api/routes/directions?routeId=${encodeURIComponent(route.route_id)}`)
      .then((r) => r.json())
      .then(setDirections)
      .catch(() => {});
  }, [route?.route_id, stop]);

  // Stops on the selected route (route state, "stops" tab)
  useEffect(() => {
    if (!route || stop) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    const dirParam = selectedDirection !== null ? `&direction=${selectedDirection}` : "";
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/routes/stops?routeId=${encodeURIComponent(route.route_id)}&q=${encodeURIComponent(q)}${dirParam}`);
      const data: StopHit[] = await res.json().catch(() => []);
      setRouteStops(data);
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [route, stop, query, selectedDirection]);

  // Live overview for the selected route
  const loadLive = useCallback(async (shortName: string) => {
    setLiveLoading(true);
    try {
      const res = await fetch(`/api/routes/live?route=${encodeURIComponent(shortName)}`);
      const data = await res.json().catch(() => ({ trips: [] }));
      setLiveTrips(data.trips ?? []);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (route && !stop && routeTab === "live") loadLive(route.route_short_name);
  }, [route, stop, routeTab, loadLive]);

  function pickRoute(r: RouteResult) {
    setRoute(r);
    setQuery("");
    setCombined({ routes: [], stops: [] });
    setRouteTab("stops");
    setLiveTrips(null);
    setDirections([]);
    setSelectedDirection(null);
  }

  function pickStop(s: StopHit) {
    saveRecent(s);
    setRecent(getRecent());
    const id = s.stop_id || s.id || "";
    const name = s.stop_name || s.name || "";
    setStop({ stop_id: id, stop_name: name });
    setQuery("");
    setCombined({ routes: [], stops: [] });
    setAvailableRoutes([]);
  }

  function findNearby() {
    if (!navigator.geolocation) { setGeoError("Location isn't available on this device."); return; }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(`/api/stops/nearby?lat=${latitude}&lon=${longitude}`);
        const data: StopHit[] = await res.json().catch(() => []);
        setNearby(data);
        setLocating(false);
      },
      () => { setGeoError("Couldn't get your location."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  // ---- Chip bar ---------------------------------------------------------
  const chips = (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {route && (
        <button
          onClick={() => setRoute(null)}
          className="inline-flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-sm font-semibold pl-3 pr-2.5 py-2 rounded-full transition-colors animate-slide-up"
        >
          {route.route_short_name}
          <span className="text-[var(--primary-dark)] text-lg leading-none">✕</span>
        </button>
      )}
      {stop && (
        <button
          onClick={() => { setStop(null); setAvailableRoutes([]); }}
          className="inline-flex items-center gap-2 bg-[var(--foreground)] hover:bg-[var(--muted)] text-white text-sm font-medium pl-3 pr-2.5 py-2 rounded-full max-w-full transition-colors animate-slide-up"
        >
          <span className="truncate">{stop.stop_name}</span>
          <span className="text-[var(--muted-light)] text-lg leading-none shrink-0">✕</span>
        </button>
      )}
    </div>
  );

  // ---- Body: stop selected (live board) ---------------------------------
  if (stop) {
    return (
      <div>
        {chips}
        {availableRoutes.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setRoute(null)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${!route ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600"}`}
            >
              All routes
            </button>
            {availableRoutes.map((rn) => (
              <button
                key={rn}
                onClick={() => setRoute({ route_id: `short:${rn}`, route_short_name: rn, route_long_name: "" })}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${route?.route_short_name === rn ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-700"}`}
              >
                {rn}
              </button>
            ))}
          </div>
        )}
        <StopBusBoard
          stopId={stop.stop_id}
          routeFilter={route?.route_short_name}
          onPointsEarned={onPointsEarned}
          onRoutesAvailable={setAvailableRoutes}
          hideHeader
        />
      </div>
    );
  }

  // ---- Body: route selected (stops list + live now) ---------------------
  if (route) {
    return (
      <div>
        {chips}
        {directions.length >= 2 && (
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setSelectedDirection(null)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                selectedDirection === null
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              }`}
            >
              Both directions
            </button>
            {directions.map((dir) => (
              <button
                key={dir.directionId}
                onClick={() => setSelectedDirection(dir.directionId)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  selectedDirection === dir.directionId
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-300 text-gray-600 hover:border-gray-400"
                }`}
              >
                → {dir.headsign}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-1 mb-3 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setRouteTab("stops")}
            className={`flex-1 text-sm font-medium py-2 rounded-md ${routeTab === "stops" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
          >
            Stops
          </button>
          <button
            onClick={() => setRouteTab("live")}
            className={`flex-1 text-sm font-medium py-2 rounded-md ${routeTab === "live" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
          >
            Live now
          </button>
        </div>

        {routeTab === "stops" ? (
          <>
            <div className="relative mb-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Filter stops on route ${route.route_short_name}…`}
                className="w-full border border-[var(--border)] bg-[var(--card)] rounded-lg px-4 py-3.5 text-base text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                autoCorrect="off" autoCapitalize="off" spellCheck={false}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {routeStops.map((s) => (
                <button
                  key={s.stop_id || s.id}
                  onClick={() => pickStop(s)}
                  className="card text-left px-4 py-3.5 active:scale-95 transition-transform"
                >
                  <span className="text-sm font-medium text-[var(--foreground)]">{s.stop_name || s.name}</span>
                  <span className="block text-xs text-[var(--muted)] mt-1">{s.stop_id || s.id}</span>
                </button>
              ))}
              {routeStops.length === 0 && (
                <p className="text-center text-[var(--muted)] py-8 text-sm">No stops match your search.</p>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            {liveLoading && !liveTrips && (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {liveTrips?.filter((t) => selectedDirection === null || t.directionId === selectedDirection).map((t) => (
              <button
                key={t.tripId}
                onClick={() => pickStop({ stop_id: t.nextStopId, stop_name: t.nextStopName })}
                className="text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 active:bg-gray-100"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    → {t.nextStopName}
                  </span>
                  <span className="text-sm font-bold text-blue-700 shrink-0">
                    {t.minutesAway === 0 ? "Due" : `${t.minutesAway} min`}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-gray-500 truncate">{t.headsign || `Direction ${t.directionId}`}</span>
                  {t.delayMinutes !== 0 && (
                    <span className={`text-xs shrink-0 ${t.delayMinutes > 0 ? "text-red-500" : "text-green-600"}`}>
                      {t.delayMinutes > 0 ? `${t.delayMinutes}m late` : `${-t.delayMinutes}m early`}
                    </span>
                  )}
                </div>
              </button>
            ))}
            {liveTrips && liveTrips.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">
                No {route.route_short_name} buses running right now.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ---- Body: discovery (nothing selected) -------------------------------
  const q = query.trim();
  const showResults = q.length >= 1 && (combined.routes.length > 0 || combined.stops.length > 0);

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a route or stop…"
          className="w-full border border-[var(--border)] bg-[var(--card)] rounded-lg px-4 py-3.5 text-base text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
          autoCorrect="off" autoCapitalize="off" spellCheck={false}
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {showResults && (
        <div className="mt-4 flex flex-col gap-5 animate-fade-in">
          {combined.routes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Routes</p>
              <div className="flex flex-col gap-2">
                {combined.routes.map((r) => (
                  <button
                    key={r.route_id}
                    onClick={() => pickRoute(r)}
                    className="card w-full text-left px-4 py-3.5 flex items-center gap-3 active:scale-95 transition-transform"
                  >
                    <span className="text-lg font-bold text-[var(--primary)] w-12 shrink-0 flex items-center justify-center bg-[var(--primary)]/10 rounded-lg">{r.route_short_name}</span>
                    <span className="text-sm text-[var(--foreground)] truncate font-medium">{r.headsign}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {combined.stops.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Stops</p>
              <div className="flex flex-col gap-2">
                {combined.stops.map((s) => (
                  <button
                    key={s.stop_id}
                    onClick={() => pickStop(s)}
                    className="card text-left px-4 py-3.5 active:scale-95 transition-transform"
                  >
                    <span className="text-sm font-medium text-[var(--foreground)]">{s.name}</span>
                    <span className="block text-xs text-[var(--muted)] mt-1">{s.id}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!showResults && q.length < 1 && (
        <div className="mt-4 flex flex-col gap-6">
          <div>
            <button
              onClick={findNearby}
              disabled={locating}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-medium py-3 rounded-lg active:bg-blue-700 disabled:opacity-60"
            >
              {locating ? "Locating…" : "📍 Stops near me"}
            </button>
            {geoError && <p className="text-xs text-red-500 mt-2">{geoError}</p>}
          </div>

          {nearby && nearby.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Nearest stops</p>
              <div className="flex flex-col gap-2">
                {nearby.map((s) => (
                  <button
                    key={s.stop_id}
                    onClick={() => pickStop(s)}
                    className="text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-baseline justify-between gap-2"
                  >
                    <span className="text-sm font-medium text-gray-900 truncate">{s.stop_name}</span>
                    {s.distanceMeters != null && (
                      <span className="text-xs text-gray-400 shrink-0">{fmtDistance(s.distanceMeters)}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          {nearby && nearby.length === 0 && (
            <p className="text-sm text-gray-400">No stops found near you.</p>
          )}

          {recent.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent stops</p>
              <div className="flex flex-col gap-2">
                {recent.map((s) => (
                  <button
                    key={s.stop_id}
                    onClick={() => pickStop(s)}
                    className="text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 active:bg-gray-100"
                  >
                    <span className="text-sm font-medium text-gray-900">{s.stop_name}</span>
                    <span className="block text-xs text-gray-400">{s.stop_id}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
