/* Fundo da cena do mascote: céu + cidade + calçada, montado em SVG/CSS (sem
   foto: as fotos do Orbis tinham o boneco antigo "assado" dentro). Se existir
   uma foto da VANT em public/vant/clima/<cena>.jpg ela entra por cima e
   cobre tudo isto; se não existir, a imagem some sozinha (onError). */
import { useMemo, useState } from "react";
import type { Estado } from "@/components/clima/ClimaTipos";

const CEU: Record<Estado, string> = {
  sol: "linear-gradient(180deg,#2f80d4 0%,#6fb4ec 42%,#f2cf96 78%,#e6a764 100%)",
  calor: "linear-gradient(180deg,#3b84cc 0%,#8ec0e8 30%,#f7c873 66%,#ef8a3c 100%)",
  nublado: "linear-gradient(180deg,#6e7a89 0%,#a3adb9 48%,#8d939b 100%)",
  chuva: "linear-gradient(180deg,#1b2737 0%,#30425a 50%,#25344a 100%)",
  tempestade: "linear-gradient(180deg,#0c101d 0%,#1b2034 50%,#2b2542 100%)",
  frio: "linear-gradient(180deg,#86afdc 0%,#c8dcf1 52%,#a6c0dc 100%)",
  noite: "linear-gradient(180deg,#04060f 0%,#0d1735 50%,#1b2650 100%)",
};
/* cor dos prédios (longe, perto), janelas acesas (0–1) e asfalto */
const CIDADE: Record<Estado, { longe: string; perto: string; luz: number; chao: string }> = {
  sol: { longe: "#8aa6c4", perto: "#3d4a5c", luz: 0.12, chao: "linear-gradient(180deg,#6d655e,#3a3632)" },
  calor: { longe: "#c9a585", perto: "#5a4a40", luz: 0.1, chao: "linear-gradient(180deg,#7a6656,#3e332b)" },
  nublado: { longe: "#7d8692", perto: "#3f454e", luz: 0.25, chao: "linear-gradient(180deg,#55585d,#2c2e31)" },
  chuva: { longe: "#2c3a4d", perto: "#151c27", luz: 0.75, chao: "linear-gradient(180deg,#1d2633,#0b0f15)" },
  tempestade: { longe: "#222538", perto: "#0e1019", luz: 0.6, chao: "linear-gradient(180deg,#171a26,#08090e)" },
  frio: { longe: "#9db3cb", perto: "#4c5d72", luz: 0.2, chao: "linear-gradient(180deg,#b9c6d4,#7d8b9a)" },
  noite: { longe: "#18213d", perto: "#0a0e1c", luz: 1, chao: "linear-gradient(180deg,#141a2b,#06080e)" },
};
const cenaDaFoto = (e: Estado) => (e === "tempestade" ? "chuva" : e === "calor" ? "sol" : e);

const rnd = (i: number, s: number) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };
function predios(seed: number, alturaMin: number, alturaMax: number) {
  const out: { x: number; w: number; h: number }[] = [];
  for (let x = -6, i = 0; x < 400; i++) { const w = 26 + Math.round(rnd(i, seed) * 34); out.push({ x, w, h: alturaMin + Math.round(rnd(i, seed + 3) * (alturaMax - alturaMin)) }); x += w + 2; }
  return out;
}

export function CenaFundo({ estado }: { estado: Estado }) {
  const c = CIDADE[estado];
  const cena = cenaDaFoto(estado);
  const [falhou, setFalhou] = useState<string[]>([]);
  const longe = useMemo(() => predios(2, 70, 150), []);
  const perto = useMemo(() => predios(9, 40, 110), []);
  return (
    <>
      <span className="absolute inset-0" style={{ background: CEU[estado], transition: "background 1s" }} />
      <svg className="absolute inset-x-0 w-full" style={{ bottom: "17%", height: "48%" }} viewBox="0 0 390 200" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <g fill={c.longe} opacity={0.75}>{longe.map((p, i) => <rect key={i} x={p.x} y={200 - p.h} width={p.w} height={p.h} />)}</g>
        <g fill={c.perto}>{perto.map((p, i) => <rect key={i} x={p.x} y={200 - p.h} width={p.w} height={p.h} rx={1} />)}</g>
        <g fill="#ffd36b" opacity={c.luz}>
          {perto.flatMap((p, i) => Array.from({ length: Math.floor(p.h / 14) * 2 }, (_, k) => {
            const col = k % 2, row = Math.floor(k / 2);
            return rnd(i * 31 + k, 5) > 0.55 ? <rect key={`${i}-${k}`} x={p.x + 6 + col * (p.w - 16)} y={200 - p.h + 8 + row * 14} width={4} height={5} /> : null;
          }))}
        </g>
      </svg>
      <span className="absolute inset-x-0 bottom-0" style={{ height: "18%", background: c.chao }} />
      <span className="absolute inset-x-0" style={{ bottom: "17.6%", height: 2, background: "rgba(255,255,255,.12)" }} />
      {!falhou.includes(cena) && (
        <img key={cena} src={`/vant/clima/${cena}.jpg`} alt="" draggable={false} onError={() => setFalhou((f) => [...f, cena])}
          className="absolute inset-0 w-full h-full object-cover" />
      )}
    </>
  );
}
