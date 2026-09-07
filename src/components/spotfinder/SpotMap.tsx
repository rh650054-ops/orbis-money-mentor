import { useEffect, useRef } from "react";

type Spot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  score?: number;
  /** "quente" = vendas reais; "testado" = alguém vendeu; "frio" = só semáforo */
  tom?: "quente" | "testado" | "frio";
  /** posição na lista (1, 2, 3…) — vira o número do pino nos 3 primeiros */
  pos?: number;
  me?: boolean;
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

    // Semáforos REAIS (OSM) sem nota: pontinhos discretos.
    (signals ?? []).forEach((sig) => {
      if (!sig.lat || !sig.lng) return;
      L.circleMarker([sig.lat, sig.lng], { radius: 3, color: "#0a0a0d", weight: 1, fillColor: "#6b7280", fillOpacity: 0.85 }).addTo(group);
      pts.push([sig.lat, sig.lng]);
    });

    // Sua posição: bolinha azul com halo.
    const eu = spots.find((s) => s.me);
    if (eu) {
      L.circleMarker([eu.lat, eu.lng], { radius: 7, color: "#ffffff", weight: 3, fillColor: "#7FD3FF", fillOpacity: 1 }).addTo(group);
      L.circleMarker([eu.lat, eu.lng], { radius: 16, color: "#7FD3FF", weight: 1, opacity: 0.35, fillColor: "#7FD3FF", fillOpacity: 0.12, interactive: false }).addTo(group);
    }

    // Sinais: pino dourado/laranja numerado nos 3 primeiros; os outros, pontos menores.
    // Ordem de desenho: frios primeiro, quentes por cima.
    const ordem = [...spots.filter((s) => !s.me)].sort((a, b) => (a.tom === "quente" ? 1 : 0) - (b.tom === "quente" ? 1 : 0) || (b.pos ?? 99) - (a.pos ?? 99));
    ordem.forEach((s) => {
      if (!s.lat || !s.lng) return;
      const quente = s.tom === "quente";
      const testado = s.tom === "testado";
      const top3 = s.pos != null && s.pos <= 3;
      const cor = quente ? "#ff7a1a" : testado || top3 ? "#F5B800" : "#3a3629";
      const tam = top3 ? 26 : quente ? 22 : 16;
      const halo = quente ? "0 0 0 8px rgba(255,122,26,.18)" : top3 ? "0 0 0 6px rgba(245,184,0,.16)" : "none";
      const label = top3 ? String(s.pos) : "";
      const html =
        `<div style="width:${tam}px;height:${tam}px;border-radius:50%;background:${cor};box-shadow:${halo};` +
        `border:2px solid #0a0a0d;display:flex;align-items:center;justify-content:center;` +
        `color:#1a1305;font-weight:900;font-size:11px;font-family:inherit">${label}</div>`;
      const icon = L.divIcon({ html, className: "", iconSize: [tam, tam], iconAnchor: [tam / 2, tam / 2] });
      const marker = L.marker([s.lat, s.lng], { icon, title: s.name, zIndexOffset: quente ? 1000 : top3 ? 500 : 0 }).addTo(group);
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
        // Tiles do OpenStreetMap — SEM chave, sem billing (o CARTO passou a exigir
        // API key e carimbava "API KEY REQUIRED" no mapa). O tema escuro vem de um
        // filtro CSS em cima dos tiles (classe .orbis-map-dark), não de outro servidor.
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
          className: "orbis-map-dark",
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
    <>
      <style>{`
        .orbis-map-dark { filter: invert(1) hue-rotate(180deg) brightness(.78) contrast(.92) saturate(.35); }
        .leaflet-container { background: #0b0b0e; font-family: inherit; }
        .leaflet-control-zoom a { background: #16151a !important; color: #e9e4d8 !important; border-color: #2a2823 !important; }
        .leaflet-control-attribution { background: rgba(10,10,13,.75) !important; color: #8a8378 !important; font-size: 9px !important; }
        .leaflet-control-attribution a { color: #b3ab9c !important; }
      `}</style>
      <div ref={ref} className="w-full h-64 rounded-[14px] overflow-hidden" style={{ border: "1px solid #22201a", background: "#0b0b0e" }} />
    </>
  );
}
