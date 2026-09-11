/* ============================================================
   CLIMA CENA — a foto, o boneco vivo e o tempo por cima.
   Estado vem do backend (clima-vendedor). Tocar na cena faz o Orbis pular
   e falar a próxima frase (o pai controla a fala). CSS em styles/clima.css.
   ============================================================ */
import { useMemo } from "react";
import { MapPin } from "lucide-react";
import "@/styles/clima.css";

export type Estado = "sol" | "calor" | "nublado" | "chuva" | "tempestade" | "frio" | "noite";

interface Props {
  estado: Estado;
  temp: number;
  condicao: string;
  linha: string;          // "máx 31° · mín 19° · sensação 29°"
  cidade: string;         // "Porto Alegre, RS"
  fontes: number;
  concordancia: number;   // 0-100
  toques: number;         // quantas vezes tocou (troca a classe do pulo)
  onToque: () => void;
}

const BASE = "/orbis/clima";
// olho aberto de cada recorte (caixa medida no PNG de 360px): x0,x1,y0,y1 e altura da imagem
const OLHOS: Record<string, [number, number, number, number, number]> = {
  calor: [216, 238, 109, 147, 946], frio: [201, 222, 111, 147, 946], chuva: [207, 226, 117, 152, 943], noite: [203, 223, 123, 155, 943],
};

const rnd = (i: number, salt: number) => { const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };
function gotas(n: number, salt: number, forte: boolean) {
  return Array.from({ length: n }, (_, i) => ({
    left: (rnd(i, salt) * 100).toFixed(1),
    h: Math.round(forte ? 22 + rnd(i, salt + 1) * 30 : 10 + rnd(i, salt + 1) * 14),
    op: (forte ? .55 + rnd(i, salt + 2) * .4 : .25 + rnd(i, salt + 2) * .35).toFixed(2),
    dur: (forte ? .55 + rnd(i, salt + 3) * .45 : 1.1 + rnd(i, salt + 3) * .9).toFixed(2),
    delay: (-rnd(i, salt + 4) * 2).toFixed(2),
  }));
}

export function ClimaCena({ estado, temp, condicao, linha, cidade, fontes, concordancia, toques, onToque }: Props) {
  const boneco = estado === "frio" ? "frio" : estado === "chuva" || estado === "tempestade" ? "chuva" : estado === "noite" ? "noite" : "calor";
  const fundo = estado === "chuva" || estado === "tempestade" ? "chuva" : estado === "noite" ? "noite" : "calor";
  const filtro = estado === "nublado" ? "nublado" : estado === "frio" ? "frio" : "";
  const acao = estado === "frio" ? "frio" : estado === "tempestade" ? "tempestade" : estado === "calor" ? "calor" : "";
  const pulo = toques === 0 ? "" : toques % 2 ? "pulo-a" : "pulo-b";
  const o = OLHOS[boneco]!;
  const ow = (o[1] - o[0]) + 8, oh = (o[3] - o[2]) + 8;
  const olho = { left: `${(((o[0] + o[1]) / 2 - ow / 2) / 360 * 100).toFixed(2)}%`, top: `${(((o[2] + o[3]) / 2 - oh / 2) / o[4] * 100).toFixed(2)}%`, width: `${(ow / 360 * 100).toFixed(2)}%`, height: `${(oh / o[4] * 100).toFixed(2)}%` };
  const boca = { left: `${(172 / 360 * 100).toFixed(2)}%`, top: `${(152 / o[4] * 100).toFixed(2)}%` };
  const leves = useMemo(() => gotas(estado === "tempestade" ? 40 : 34, 1, false), [estado]);
  const fortes = useMemo(() => gotas(estado === "tempestade" ? 110 : 70, 7, true), [estado]);
  const sol = estado === "sol" || estado === "calor";

  return (
    <div className="cl-cena" onClick={onToque} role="button" aria-label="Toque pra ouvir o Orbis">
      <div className="cl-mundo">
        <img className={`cl-fundo ${filtro}`} src={`${BASE}/${fundo}.jpg`} alt="" draggable={false} />
        {estado === "nublado" && <span className="cl-fx cl-veu-cinza" />}
        {estado === "frio" && <span className="cl-fx cl-veu-frio" />}
        {estado === "chuva" && <span className="cl-fx cl-veu-chuva" />}
        {estado === "tempestade" && <span className="cl-fx cl-veu-tempestade" />}
        {sol && (
          <span className="cl-fx">
            <span className={`cl-sol-raios ${estado === "calor" ? "forte" : ""}`} />
            <span className={`cl-sol-halo ${estado === "calor" ? "forte" : ""}`} />
            <span className={`cl-sol-disco ${estado === "calor" ? "forte" : ""}`} />
          </span>
        )}
        {estado === "nublado" && (
          <span className="cl-fx"><span className="cl-nuvem n3" /><span className="cl-nuvem n1" /><span className="cl-nuvem n2" /><span className="cl-nuvem n4" /></span>
        )}
        {estado === "frio" && (
          <span className="cl-vento">
            <Rajada cls="r5" d="M2 18 C 50 4, 90 30, 140 14 S 190 12, 198 20" />
            <Rajada cls="r3" d="M2 20 C 40 6, 80 30, 120 16 S 180 10, 198 18" />
          </span>
        )}
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

        {/* o boneco: fora respira/pula, dentro reage ao clima */}
        <div className={`cl-boneco ${pulo}`}>
          <div className={`cl-corpo ${acao}`}>
            <img src={`${BASE}/${boneco}-boneco.webp`} alt="Orbis" draggable={false} />
            <span className="cl-palpebra" style={olho} />
            {estado === "frio" && (<><span className="cl-halito" style={boca} /><span className="cl-halito b" style={boca} /></>)}
          </div>
        </div>

        {/* na frente: calor no ar, chuva, vento */}
        {estado === "calor" && (<><span className="cl-fx cl-quente" /><span className="cl-mormaco" /></>)}
        {(estado === "chuva" || estado === "tempestade") && (
          <>
            <span className="cl-chuva leve">{leves.map((g, i) => <span key={i} className="cl-gota" style={{ left: `${g.left}%`, height: g.h, opacity: Number(g.op), animationDuration: `${g.dur}s`, animationDelay: `${g.delay}s` }} />)}</span>
            <span className={`cl-chuva forte ${estado === "tempestade" ? "vento" : ""}`}>{fortes.map((g, i) => <span key={i} className="cl-gota" style={{ left: `${g.left}%`, height: g.h, opacity: Number(g.op), animationDuration: `${g.dur}s`, animationDelay: `${g.delay}s` }} />)}</span>
            <span className="cl-respingo" />
          </>
        )}
        {estado === "frio" && (
          <span className="cl-vento" style={{ opacity: .7 }}>
            <Rajada cls="r1" d="M2 16 C 46 2, 92 28, 138 12 S 186 14, 198 18" />
            <Rajada cls="r2" d="M2 22 C 50 8, 100 30, 150 14 S 190 16, 198 20" />
            <Rajada cls="r4" d="M2 14 C 60 30, 110 4, 160 20 S 190 12, 198 16" />
          </span>
        )}
        {estado === "noite" && <span className="cl-fx cl-estrelas" />}
      </div>
      <span className="cl-fx cl-escuro" />

      {/* topo */}
      <div className="absolute left-4 right-4 top-3.5 flex items-center justify-between gap-2">
        <span className="cl-chip-agora"><MapPin className="w-3 h-3" strokeWidth={2.4} />{cidade || "sua região"} · GPS</span>
        <span className="cl-chip-agora" style={{ color: "var(--orbis-gold,#F5B800)" }}>{fontes} fontes · {concordancia}%</span>
      </div>
      {/* temperatura */}
      {/* bottom-12: o balão da opinião sobe 30px pra dentro da cena, a linha de máx/mín tem que ficar acima dele */}
      <div className="absolute left-[18px] bottom-12 flex flex-col gap-0.5">
        <span className="orbis-num text-[74px] font-extrabold leading-[.95] tracking-[-.03em]" style={{ textShadow: "0 6px 24px rgba(0,0,0,.6)" }}>{Math.round(temp)}°</span>
        <span className="text-[16px] font-extrabold" style={{ textShadow: "0 2px 12px rgba(0,0,0,.6)" }}>{condicao}</span>
        <span className="orbis-num text-[12.5px]" style={{ color: "rgba(255,255,255,.8)" }}>{linha}</span>
      </div>
    </div>
  );
}

function Rajada({ cls, d }: { cls: string; d: string }) {
  return <span className={`cl-rajada ${cls}`}><svg viewBox="0 0 200 34" preserveAspectRatio="none"><path d={d} /></svg></span>;
}
