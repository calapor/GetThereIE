"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { RouteResult } from "./RouteSearch";
import StopBusBoard from "./StopBusBoard";

interface StopHit {
  stop_id: string;
  stop_name: string;
  stop_lat?: number | null;
  stop_lon?: number | null;
  distanceMeters?: number;
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
  const entry = { stop_id: stop.stop_id, stop_name: stop.stop_name };
  const prev = getRecent().filter((s) => s.stop_id !== stop.stop_id);
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
    setStop({ stop_id: s.stop_id, stop_name: s.stop_name });
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
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {route && (
        <button
          onClick={() => setRoute(null)}
          className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold pl-3 pr-2 py-1.5 rounded-full"
        >
          🚌 {route.route_short_name}
          <span className="text-blue-200 text-base leading-none">✕</span>
        </button>
      )}
      {stop && (
        <button
          onClick={() => { setStop(null); setAvailableRoutes([]); }}
          className="inline-flex items-center gap-1.5 bg-gray-800 text-white text-sm font-medium pl-3 pr-2 py-1.5 rounded-full max-w-full"
        >
          <span className="truncate">📍 {stop.stop_name}</span>
          <span className="text-gray-400 text-base leading-none shrink-0">✕</span>
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
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter stops on the ${route.route_short_name}`}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3"
              autoCorrect="off" autoCapitalize="off" spellCheck={false}
            />
            <div className="flex flex-col gap-2">
              {routeStops.map((s) => (
                <button
                  key={s.stop_id}
                  onClick={() => pickStop(s)}
                  className="text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 active:bg-gray-100"
                >
                  <span className="text-sm font-medium text-gray-900">{s.stop_name}</span>
                  <span className="block text-xs text-gray-400">{s.stop_id}</span>
                </button>
              ))}
              {routeStops.length === 0 && (
                <p className="text-center text-gray-400 py-8 text-sm">No stops match.</p>
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
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a route or stop (e.g. 14, O'Connell St)"
        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
        autoCorrect="off" autoCapitalize="off" spellCheck={false}
        autoFocus
      />

      {showResults && (
        <div className="mt-3 flex flex-col gap-4">
          {combined.routes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Routes</p>
              <div className="flex flex-col gap-1">
                {combined.routes.map((r) => (
                  <button
                    key={r.route_id}
                    onClick={() => pickRoute(r)}
                    className="w-full text-left px-4 py-2.5 flex items-baseline gap-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <span className="text-sm font-bold text-blue-700 w-10 shrink-0">{r.route_short_name}</span>
                    <span className="text-sm text-gray-700 truncate">{r.route_long_name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {combined.stops.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Stops</p>
              <div className="flex flex-col gap-1">
                {combined.stops.map((s) => (
                  <button
                    key={s.stop_id}
                    onClick={() => pickStop(s)}
                    className="text-left px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50"
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
