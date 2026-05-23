import { useEffect, useRef } from "react";

type Spot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  score?: number;
};

type Props = {
  center: { lat: number; lng: number };
  spots: Spot[];
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
  if (score == null) return "#888";
  if (score >= 8) return "#22c55e";
  if (score >= 6) return "#f4a100";
  if (score >= 4) return "#f97316";
  return "#ef4444";
}

export default function SpotMap({ center, spots, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

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
            styles: [
              { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
              { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
              { elementType: "labels.text.stroke", stylers: [{ color: "#0d0d0d" }] },
              { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
              { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#3a3a3a" }] },
              { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4a4a4a" }] },
              { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1a2a" }] },
              { featureType: "poi", stylers: [{ visibility: "off" }] },
              { featureType: "transit", stylers: [{ visibility: "off" }] },
            ],
          });
        }

        // clear old markers
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(center);

        spots.forEach((s) => {
          if (!s.lat || !s.lng) return;
          const color = scoreColor(s.score);
          const marker = new window.google.maps.Marker({
            position: { lat: s.lat, lng: s.lng },
            map: mapRef.current,
            title: s.name,
            label: {
              text: s.score != null ? s.score.toFixed(1) : "?",
              color: "#0d0d0d",
              fontSize: "11px",
              fontWeight: "700",
            },
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 16,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#0d0d0d",
              strokeWeight: 2,
            },
          });
          marker.addListener("click", () => onSelect?.(s.id));
          markersRef.current.push(marker);
          bounds.extend({ lat: s.lat, lng: s.lng });
        });

        if (spots.length > 0) mapRef.current.fitBounds(bounds, 60);
      })
      .catch((err) => console.error(err));

    return () => {
      cancelled = true;
    };
  }, [center.lat, center.lng, spots, onSelect]);

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
