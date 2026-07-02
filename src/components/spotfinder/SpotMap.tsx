import { useEffect, useRef } from "react";
import { readThemeColor } from "@/shared/lib/theme-colors";

type Spot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  score?: number;
};

// Camada opcional de semáforos reais (OSM) plotada junto dos spots.
type Signal = { id: string; lat: number; lng: number };

type Props = {
  center: { lat: number; lng: number };
  spots: Spot[];
  signals?: Signal[];
  onSelect?: (id: string) => void;
};

declare global {
  interface Window {
    google: any;
    __initSpotMap?: () => void;
  }
}

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

let loaderPromise: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  if (loaderPromise) return loaderPromise;
  if (window.google?.maps) return Promise.resolve();
  loaderPromise = new Promise((resolve, reject) => {
    window.__initSpotMap = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__initSpotMap${TRACKING_ID ? `&channel=${TRACKING_ID}` : ""}`;
    s.async = true;
    s.onerror = () => reject(new Error("Falha ao carregar Google Maps"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

function scoreColor(score?: number) {
  if (score == null) return readThemeColor("--muted-foreground");
  if (score >= 8) return readThemeColor("--success");
  if (score >= 6) return readThemeColor("--primary");
  if (score >= 4) return readThemeColor("--warning");
  return readThemeColor("--destructive");
}

function buildMapStyles() {
  const card = readThemeColor("--card");
  const mutedFg = readThemeColor("--muted-foreground");
  const background = readThemeColor("--background");
  const border = readThemeColor("--border");
  const muted = readThemeColor("--muted");
  const secondary = readThemeColor("--secondary");
  return [
    { elementType: "geometry", stylers: [{ color: card }] },
    { elementType: "labels.text.fill", stylers: [{ color: mutedFg }] },
    { elementType: "labels.text.stroke", stylers: [{ color: background }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: muted }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: border }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: secondary }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: background }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
  ];
}

export default function SpotMap({ center, spots, signals, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const signalMarkersRef = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !ref.current) return;
        if (!mapRef.current) {
          mapRef.current = new window.google.maps.Map(ref.current, {
            center,
            zoom: 13,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy",
            styles: buildMapStyles(),
          });
        }

        // clear old markers
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];
        signalMarkersRef.current.forEach((m) => m.setMap(null));
        signalMarkersRef.current = [];

        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(center);

        // Camada de SEMÁFOROS REAIS (OSM): pontinhos pequenos, sem rótulo.
        (signals ?? []).forEach((sig) => {
          if (!sig.lat || !sig.lng) return;
          const dot = new window.google.maps.Marker({
            position: { lat: sig.lat, lng: sig.lng },
            map: mapRef.current,
            title: "Semáforo",
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 5,
              fillColor: readThemeColor("--warning"),
              fillOpacity: 0.9,
              strokeColor: readThemeColor("--background"),
              strokeWeight: 1,
            },
            zIndex: 1,
          });
          signalMarkersRef.current.push(dot);
          bounds.extend({ lat: sig.lat, lng: sig.lng });
        });

        spots.forEach((s) => {
          if (!s.lat || !s.lng) return;
          const color = scoreColor(s.score);
          const marker = new window.google.maps.Marker({
            position: { lat: s.lat, lng: s.lng },
            map: mapRef.current,
            title: s.name,
            label: {
              text: s.score != null ? s.score.toFixed(1) : "?",
              color: readThemeColor("--background"),
              fontSize: "11px",
              fontWeight: "700",
            },
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 16,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: readThemeColor("--background"),
              strokeWeight: 2,
            },
          });
          marker.addListener("click", () => onSelect?.(s.id));
          markersRef.current.push(marker);
          bounds.extend({ lat: s.lat, lng: s.lng });
        });

        if (spots.length > 0 || (signals?.length ?? 0) > 0) mapRef.current.fitBounds(bounds, 60);
      })
      .catch((err) => console.error(err));

    return () => {
      cancelled = true;
    };
  }, [center.lat, center.lng, spots, signals, onSelect]);

  if (!BROWSER_KEY) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
        Mapa indisponível: chave do Google Maps não configurada.
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="w-full h-64 rounded-xl overflow-hidden border border-border bg-card"
    />
  );
}
