/* Efeitos do tempo na cena (as mesmas camadas da cena do Orbis, CSS em
   styles/clima.css). ATRÁS do mascote: sol, nuvens, raios, estrelas.
   NA FRENTE: chuva, respingo, mormaço, vento. */
import { useMemo } from "react";
import type { Estado } from "@/components/clima/ClimaTipos";

const rnd = (i: number, s: number) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };
function gotas(n: number, salt: number, forte: boolean) {
  return Array.from({ length: n }, (_, i) => ({
    left: (rnd(i, salt) * 100).toFixed(1),
    h: Math.round(forte ? 22 + rnd(i, salt + 1) * 30 : 10 + rnd(i, salt + 1) * 14),
    op: forte ? 0.55 + rnd(i, salt + 2) * 0.4 : 0.25 + rnd(i, salt + 2) * 0.35,
    dur: (forte ? 0.55 + rnd(i, salt + 3) * 0.45 : 1.1 + rnd(i, salt + 3) * 0.9).toFixed(2),
    delay: (-rnd(i, salt + 4) * 2).toFixed(2),
  }));
}

function Rajada({ cls, d }: { cls: string; d: string }) {
  return <span className={`cl-rajada ${cls}`}><svg viewBox="0 0 200 34" preserveAspectRatio="none"><path d={d} /></svg></span>;
}

export function FxAtras({ estado }: { estado: Estado }) {
  const sol = estado === "sol" || estado === "calor";
  const forte = estado === "calor" ? "forte" : "";
  return (
    <>
      {estado === "nublado" && <span className="cl-fx cl-veu-cinza" />}
      {estado === "frio" && <span className="cl-fx cl-veu-frio" />}
      {sol && <span className="cl-fx"><span className={`cl-sol-raios ${forte}`} /><span className={`cl-sol-halo ${forte}`} /><span className={`cl-sol-disco ${forte}`} /></span>}
      {(estado === "nublado" || estado === "chuva") && (
        <span className="cl-fx" style={{ opacity: estado === "chuva" ? 0.35 : 1 }}><span className="cl-nuvem n3" /><span className="cl-nuvem n1" /><span className="cl-nuvem n2" /><span className="cl-nuvem n4" /></span>
      )}
      {estado === "noite" && <span className="cl-fx cl-estrelas" />}
      {estado === "tempestade" && (
        <>
          <span className="cl-fx cl-clarao" />
          <span className="cl-raios">
            <svg viewBox="0 0 390 540" preserveAspectRatio="none">
              <defs>
                <filter id="cl-brilho" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <path className="cl-raio a" d="M130 -10 L108 70 L140 76 L100 160 L134 166 L84 270 M108 70 L82 108 M100 160 L70 190" />
              <path className="cl-raio b" d="M320 -10 L300 58 L326 64 L292 140 L318 146 L280 230 M300 58 L276 80" />
              <path className="cl-raio c" d="M220 -10 L206 44 L226 50 L196 120 L214 124 L184 190" />
            </svg>
          </span>
        </>
      )}
      {estado === "frio" && (
        <span className="cl-vento"><Rajada cls="r5" d="M2 18 C 50 4, 90 30, 140 14 S 190 12, 198 20" /><Rajada cls="r3" d="M2 20 C 40 6, 80 30, 120 16 S 180 10, 198 18" /></span>
      )}
    </>
  );
}

export function FxFrente({ estado }: { estado: Estado }) {
  const chove = estado === "chuva" || estado === "tempestade";
  const leves = useMemo(() => gotas(estado === "tempestade" ? 40 : 34, 1, false), [estado]);
  const fortes = useMemo(() => gotas(estado === "tempestade" ? 110 : 70, 7, true), [estado]);
  return (
    <>
      {estado === "calor" && <><span className="cl-fx cl-quente" /><span className="cl-mormaco" /></>}
      {chove && (
        <>
          <span className="cl-chuva leve">{leves.map((g, i) => <span key={i} className="cl-gota" style={{ left: `${g.left}%`, height: g.h, opacity: g.op, animationDuration: `${g.dur}s`, animationDelay: `${g.delay}s` }} />)}</span>
          <span className={`cl-chuva forte ${estado === "tempestade" ? "vento" : ""}`}>{fortes.map((g, i) => <span key={i} className="cl-gota" style={{ left: `${g.left}%`, height: g.h, opacity: g.op, animationDuration: `${g.dur}s`, animationDelay: `${g.delay}s` }} />)}</span>
          <span className="cl-respingo" />
        </>
      )}
      {estado === "frio" && (
        <span className="cl-vento" style={{ opacity: 0.7 }}>
          <Rajada cls="r1" d="M2 16 C 46 2, 92 28, 138 12 S 186 14, 198 18" />
          <Rajada cls="r2" d="M2 22 C 50 8, 100 30, 150 14 S 190 16, 198 20" />
          <Rajada cls="r4" d="M2 14 C 60 30, 110 4, 160 20 S 190 12, 198 16" />
        </span>
      )}
    </>
  );
}
