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
    L: any;
  }
}

// Carrega o Leaflet (mapa OpenStreetMap) via CDN — sem chave, sem billing.
let leafletPromise: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (window.L) return Promise.resolve();
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar o mapa"));
    document.head.appendChild(s);
  });
  return leafletPromise;
}

function scoreColor(score?: number) {
  if (score == null) return readThemeColor("--muted-foreground");
  if (score >= 8) return readThemeColor("--success");
  if (score >= 6) return readThemeColor("--primary");
  if (score >= 4) return readThemeColor("--warning");
  return readThemeColor("--destructive");
}

export default function SpotMap({ center, spots, signals, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  // onSelect num ref: mantem o handler atual sem recriar o mapa a cada render.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Redesenha os marcadores no mapa ja existente (sem recriar o mapa).
  function drawMarkers() {
    const L = window.L;
    if (!L || !mapRef.current || !layerRef.current) return;
    const group = layerRef.current;
    group.clearLayers();
    const pts: [number, number][] = [];

    // Semáforos REAIS (OSM): pontinhos pequenos.
    (signals ?? []).forEach((sig) => {
      if (!sig.lat || !sig.lng) return;
      L.circleMarker([sig.lat, sig.lng], {
        radius: 4,
        color: readThemeColor("--background"),
        weight: 1,
        fillColor: readThemeColor("--warning"),
        fillOpacity: 0.9,
      }).addTo(group);
      pts.push([sig.lat, sig.lng]);
    });

    // Spots pontuados: círculo colorido com a nota.
    spots.forEach((s) => {
      if (!s.lat || !s.lng) return;
      const color = scoreColor(s.score);
      const bg = readThemeColor("--background");
      const html =
        `<div style="width:30px;height:30px;border-radius:50%;background:${color};` +
        `border:2px solid ${bg};display:flex;align-items:center;justify-content:center;` +
        `color:${bg};font-weight:700;font-size:11px;">${s.score != null ? s.score.toFixed(1) : "?"}</div>`;
      const icon = L.divIcon({ html, className: "", iconSize: [30, 30], iconAnchor: [15, 15] });
      const marker = L.marker([s.lat, s.lng], { icon, title: s.name }).addTo(group);
      marker.on("click", () => onSelectRef.current?.(s.id));
      pts.push([s.lat, s.lng]);
    });

    if (pts.length > 0) {
      mapRef.current.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
    } else {
      mapRef.current.setView([center.lat, center.lng], 13);
    }
  }

  // 1) Cria o mapa UMA vez e o DESTROI no unmount. Corrige o vazamento:
  //    antes o mapa/tiles/listeners nunca eram removidos ("Map container is
  //    already initialized") e o setTimeout nao era limpo.
  useEffect(() => {
    let cancelled = false;
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;
    loadLeaflet()
      .then(() => {
        if (cancelled || !ref.current || mapRef.current) return;
        const L = window.L;
        mapRef.current = L.map(ref.current, { zoomControl: true }).setView(
          [center.lat, center.lng],
          13,
        );
        // Tiles escuros (CartoDB) — gratuitos, combinam com o tema do app.
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: "&copy; OpenStreetMap &copy; CARTO",
          maxZoom: 19,
        }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
        drawMarkers();
        // Corrige o layout dos tiles quando o container acabou de aparecer.
        invalidateTimer = setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 120);
      })
      .catch((err) => console.error(err));

    return () => {
      cancelled = true;
      if (invalidateTimer) clearTimeout(invalidateTimer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Atualiza SO os marcadores quando os dados mudam — sem recriar o mapa.
  useEffect(() => {
    drawMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, spots, signals]);

  return (
    <div
      ref={ref}
      className="w-full h-64 rounded-xl overflow-hidden border border-border bg-card"
    />
  );
}
