import { useEffect, useRef, useState } from "react";

// Distância entre dois pontos (metros) — fórmula de Haversine.
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // raio da Terra em metros
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type GpsPermission = "unknown" | "granted" | "denied" | "unsupported";

/**
 * Mede a distância REAL andada por GPS enquanto `active` for true (ex: DEFCON rodando).
 * Acumula entre atualizações de posição, filtrando ruído do GPS:
 * - ignora leituras com baixa precisão (>35m);
 * - ignora micro-movimentos (<4m, tremida parado) e saltos irreais (>12 m/s ~ carro/erro).
 * Ao pausar (active=false), esquece a última posição pra não somar um "salto" na volta.
 */
export function useDistanceTracker(active: boolean) {
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [permission, setPermission] = useState<GpsPermission>("unknown");
  const distRef = useRef(0);
  const lastRef = useRef<{ lat: number; lon: number; ts: number } | null>(null);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      if (watchRef.current != null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      lastRef.current = null; // não soma o deslocamento do tempo parado
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPermission("unsupported");
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPermission("granted");
        const { latitude, longitude, accuracy } = pos.coords;
        if (accuracy != null && accuracy > 35) return; // leitura ruim, ignora
        const now = pos.timestamp || Date.now();
        const prev = lastRef.current;
        if (prev) {
          const d = haversine(prev.lat, prev.lon, latitude, longitude);
          const dt = (now - prev.ts) / 1000;
          const speed = dt > 0 ? d / dt : 0; // m/s
          if (d >= 4 && d <= 2000 && speed <= 12) {
            distRef.current += d;
            setDistanceMeters(distRef.current);
          }
        }
        lastRef.current = { lat: latitude, lon: longitude, ts: now };
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermission("denied");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [active]);

  return { distanceMeters, permission };
}
