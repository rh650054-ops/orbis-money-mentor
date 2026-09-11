/* ============================================================
   CLIMA CENA — a foto, o boneco vivo e o tempo por cima.
   Estado vem do backend (clima-vendedor). Tocar na cena faz o Orbis pular
   e falar a próxima frase (o pai controla a fala). CSS em styles/clima.css.
   ============================================================ */
import { useEffect, useMemo, useRef } from "react";
import { MapPin, RefreshCw, Loader2 } from "lucide-react";
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
  carregando?: boolean;   // o atualizar mora aqui desde que o cabeçalho saiu
  onAtualizar?: () => void;
}

const BASE = "/orbis/clima";
const V = "?v=2"; // imagens novas, no dobro da resolução — o ?v=2 fura o cache antigo
// altura da imagem de cada recorte (pra posicionar o hálito do frio)
const ALTURA: Record<string, number> = { calor: 1892, frio: 1892, chuva: 1886, noite: 1886 };

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

export function ClimaCena({ estado, temp, condicao, linha, cidade, fontes, concordancia, toques, onToque, carregando, onAtualizar }: Props) {
  const boneco = estado === "frio" ? "frio" : estado === "chuva" || estado === "tempestade" ? "chuva" : estado === "noite" ? "noite" : "calor";
  // o fundo tem que ser o da MESMA foto do boneco: a foto de trás já tem o
  // personagem dentro, e o recorte encaixa exatamente em cima dele. Misturar
  // (boneco de frio no fundo de calor) mostrava dois Orbis na mesma cena.
  const fundo = estado === "chuva" || estado === "tempestade" ? "chuva" : estado === "noite" ? "noite" : estado === "frio" ? "frio" : "calor";
  const filtro = estado === "nublado" ? "nublado" : "";
  const acao = estado === "frio" ? "frio" : estado === "tempestade" ? "tempestade" : estado === "calor" ? "calor" : "";
  const boca = { left: `${(344 / 720 * 100).toFixed(2)}%`, top: `${(304 / (ALTURA[boneco] ?? 1886) * 100).toFixed(2)}%` };
  const leves = useMemo(() => gotas(estado === "tempestade" ? 40 : 34, 1, false), [estado]);
  const fortes = useMemo(() => gotas(estado === "tempestade" ? 110 : 70, 7, true), [estado]);
  const sol = estado === "sol" || estado === "calor";

  /* MOVIMENTO DO BONECO — feito em JavaScript de propósito.
     Quando o celular está no modo economia de bateria (ou com "reduzir
     animações" ligado), o navegador CONGELA as animações de CSS e o Orbis
     ficava parado feito estátua. Desenhar quadro a quadro aqui continua
     funcionando nesses celulares. */
  const refBoneco = useRef<HTMLDivElement>(null);
  const refCorpo = useRef<HTMLDivElement>(null);
  const refPulo = useRef(-99);
  useEffect(() => { if (toques > 0) refPulo.current = performance.now(); }, [toques]);
  useEffect(() => {
    const el = refBoneco.current, corpo = refCorpo.current;
    if (!el) return;
    const calmo = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const amp = calmo ? 1.6 : 4;         // quanto ele sobe e desce respirando
    const t0 = performance.now();
    let raf = 0, vivo = true;
    const passo = (t: number) => {
      if (!vivo) return;
      const s = (t - t0) / 1000;
      // respirar: sobe e desce devagar, com uma inclinação num ritmo diferente (não fica robótico)
      let y = Math.sin((s / 5.2) * Math.PI * 2) * -amp;
      let escala = 1 + Math.sin((s / 5.2) * Math.PI * 2) * .006;
      const giro = Math.sin((s / 7.4) * Math.PI * 2) * (calmo ? .12 : .35);
      // pulo do toque (dura 0,95 s)
      const dt = (t - refPulo.current) / 1000;
      if (dt >= 0 && dt < .95) {
        const k = dt / .95;
        y -= Math.sin(Math.PI * k) * (calmo ? 8 : 26);
        escala += Math.sin(Math.PI * k) * .018;
      }
      el.style.transform = `translate3d(0,${y.toFixed(2)}px,0) rotate(${giro.toFixed(3)}deg) scale(${escala.toFixed(4)})`;
      // o corpo reage ao clima: treme de frio, se abana no calor, se encolhe na tempestade
      if (corpo) {
        if (acao === "frio") corpo.style.transform = `translate3d(${(Math.sin(s * 34) * (calmo ? .5 : 1.5)).toFixed(2)}px,0,0) rotate(${(Math.sin(s * 31) * (calmo ? .12 : .38)).toFixed(3)}deg)`;
        else if (acao === "calor") corpo.style.transform = `translate3d(0,${(Math.sin((s / 2.2) * Math.PI * 2) * -2).toFixed(2)}px,0) rotate(${(Math.sin((s / 2.2) * Math.PI * 2) * 1.3).toFixed(3)}deg)`;
        else if (acao === "tempestade") corpo.style.transform = `translate3d(0,${(2.5 + Math.sin((s / 2.4) * Math.PI * 2) * 2.5).toFixed(2)}px,0) scale(.99) rotate(${(Math.sin((s / 2.4) * Math.PI * 2) * -.5).toFixed(3)}deg)`;
        else corpo.style.transform = "";
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => { vivo = false; cancelAnimationFrame(raf); };
  }, [acao]);

  return (
    <div className="cl-cena" onClick={onToque} role="button" aria-label="Toque pra ouvir o Orbis">
      <div className="cl-mundo">
        <img className={`cl-fundo ${filtro}`} src={`${BASE}/${fundo}.jpg${V}`} alt="" draggable={false} />
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

        {/* o boneco: fora respira/pula, dentro reage ao clima (movimento em JS, ver acima) */}
        <div className="cl-boneco" ref={refBoneco}>
          <div className="cl-corpo" ref={refCorpo}>
            <img src={`${BASE}/${boneco}-boneco.webp${V}`} alt="Orbis" draggable={false} />
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
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="cl-chip-agora" style={{ color: "var(--orbis-gold,#F5B800)" }}>{fontes} fontes · {concordancia}%</span>
          {onAtualizar && (
            <button type="button" aria-label="Atualizar o clima" disabled={carregando}
              onClick={(e) => { e.stopPropagation(); onAtualizar(); }}
              className="cl-chip-agora orbis-press disabled:opacity-60" style={{ width: 26, padding: 0, justifyContent: "center" }}>
              {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#F5B800" }} /> : <RefreshCw className="w-3.5 h-3.5" strokeWidth={2.4} />}
            </button>
          )}
        </span>
      </div>
      {/* temperatura */}
      {/* bottom-12: o balão da opinião sobe 30px pra dentro da cena, a linha de máx/mín tem que ficar acima dele */}
      <div className="absolute left-[18px] right-[18px] bottom-12 flex flex-col gap-0.5">
        {/* tamanhos acompanham a largura do celular */}
        <span className="orbis-num font-extrabold leading-[.95] tracking-[-.03em]" style={{ fontSize: "clamp(46px,15vw,74px)", textShadow: "0 6px 24px rgba(0,0,0,.6)" }}>{Math.round(temp)}°</span>
        <span className="font-extrabold" style={{ fontSize: "clamp(14px,4.2vw,16px)", textShadow: "0 2px 12px rgba(0,0,0,.6)" }}>{condicao}</span>
        <span className="orbis-num" style={{ fontSize: "clamp(11px,3.3vw,12.5px)", color: "rgba(255,255,255,.8)" }}>{linha}</span>
      </div>
    </div>
  );
}

function Rajada({ cls, d }: { cls: string; d: string }) {
  return <span className={`cl-rajada ${cls}`}><svg viewBox="0 0 200 34" preserveAspectRatio="none"><path d={d} /></svg></span>;
}
