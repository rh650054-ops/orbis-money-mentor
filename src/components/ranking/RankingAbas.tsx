/* DESAFIO AVANTE — o painel do prêmio no topo do Ranking (Rick, 29/10/2026).
   Um painel só, no visual do pódio: o prêmio da aba (R$ 500 no Mensal, R$ 50 no Semanal),
   o cronômetro até fechar, onde a pessoa está e quanto falta pro 1º, e as abas
   Mensal | Semanal dentro dele. Fora da janela do desafio vira só as abas.
   Motion (30/10): entrada uma vez (painel desce, emblema estoura, número conta até o prêmio,
   blocos sobem, barra enche), ambiente discreto (raios giram, número respira, brilho varre
   a cada 7 s, o segundo vira), última hora em vermelho, subiu de posição pisca dourado. */
import { useEffect, useRef, useState } from "react";
import { Trophy, Zap } from "lucide-react";
import { premioDaAba, PREMIO_FIM, type Aba } from "./premiacao";

const OURO = "#F5B800";
const OURO_CLARO = "#F5D77A";
const brl0 = (n: number) => "R$ " + Math.round(n).toLocaleString("pt-BR");

/** ms until the period closes (23:59:59 Brasília of its last day). */
function msAteFechar(aba: Aba, fimSemana: string): number {
  const fim = aba === "mensal" ? PREMIO_FIM : fimSemana;
  return Date.parse(`${fim}T23:59:59-03:00`) - Date.now();
}

/** Counts 0 → alvo in ~900 ms when the target changes (tab switch too). */
function useContagem(alvo: number): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const ini = performance.now(); let raf = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - ini) / 900); const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(alvo * e));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo]);
  return v;
}

function Digito({ v, vira }: { v: string; vira: boolean }) {
  return <p key={vira ? v : "fixo"} className={`orbis-num text-[20px] font-black leading-none text-white tabular-nums ${vira ? "vant-vira" : ""}`}>{v}</p>;
}

function Cronometro({ aba, fimSemana }: { aba: Aba; fimSemana: string }) {
  const [ms, setMs] = useState(() => msAteFechar(aba, fimSemana));
  useEffect(() => {
    setMs(msAteFechar(aba, fimSemana));
    const t = setInterval(() => setMs(msAteFechar(aba, fimSemana)), 1000);
    return () => clearInterval(t);
  }, [aba, fimSemana]);
  const s = Math.max(0, Math.floor(ms / 1000));
  const urgente = s > 0 && s < 3600;
  const partes: [string, string, boolean][] = [
    [String(Math.floor(s / 86400)), "dias", false], [String(Math.floor((s % 86400) / 3600)).padStart(2, "0"), "horas", false],
    [String(Math.floor((s % 3600) / 60)).padStart(2, "0"), "min", false], [String(s % 60).padStart(2, "0"), "seg", true],
  ];
  return (
    <div className="grid grid-cols-4 gap-1.5" aria-label="Fecha em">
      {partes.map(([v, k, vira], i) => (
        <div key={k} className={`vant-sobe rounded-[10px] py-1.5 text-center overflow-hidden ${urgente ? "vant-urgente" : ""}`}
          style={{ background: "rgba(0,0,0,.45)", border: `1px solid ${urgente ? "rgba(242,70,90,.5)" : "rgba(245,184,0,.18)"}`, animationDelay: `${0.35 + i * 0.07}s` }}>
          <Digito v={v} vira={vira} />
          <p className="text-[9px] font-bold tracking-[.12em] uppercase mt-0.5" style={{ color: urgente ? "#ff8a8a" : "#b9b3a6" }}>{k}</p>
        </div>
      ))}
    </div>
  );
}

export function RankingAbas({ aba, onAba, hoje, periodoSemana, fimSemana, posicao, faltaPro1, meuValor }: {
  aba: Aba; onAba: (a: Aba) => void; hoje: string; periodoSemana: string; fimSemana: string;
  /** the viewer's place, how much to the 1st and his own total — the hook that sends him back to the street */
  posicao?: number | null; faltaPro1?: number | null; meuValor?: number | null;
}) {
  const premio = premioDaAba(aba, hoje);
  const valor = useContagem(premio?.valor ?? 0);
  // subiu de posição desde a última leitura → a linha pisca em dourado
  const posAnterior = useRef<number | null>(null);
  const [subiu, setSubiu] = useState(false);
  useEffect(() => {
    if (typeof posicao === "number" && posAnterior.current !== null && posicao < posAnterior.current) { setSubiu(true); const t = setTimeout(() => setSubiu(false), 1300); return () => clearTimeout(t); }
    posAnterior.current = typeof posicao === "number" ? posicao : null;
  }, [posicao]);

  const abas = (escuro: boolean) => (
    <div role="tablist" aria-label="Período do ranking" className="flex gap-1 p-1 rounded-[15px]" style={{ background: escuro ? "rgba(0,0,0,.45)" : "#121211", border: "1px solid rgba(255,255,255,.08)" }}>
      {(["mensal", "semanal"] as Aba[]).map((a) => {
        const on = aba === a;
        return (
          <button key={a} type="button" role="tab" aria-selected={on} onClick={() => onAba(a)}
            className="flex-1 h-10 rounded-[12px] text-[13.5px] font-black transition-colors"
            style={on ? { background: OURO, color: "#1a1305" } : { color: "#b9b3a6" }}>
            {a === "mensal" ? "Mensal" : "Semanal"}
          </button>
        );
      })}
    </div>
  );

  if (!premio) {
    return (
      <div className="space-y-2.5">
        {abas(false)}
        {aba === "semanal" && <p className="text-center text-[12px] font-bold" style={{ color: "#b9b3a6" }}>{periodoSemana} · fecha sábado 23:59</p>}
      </div>
    );
  }

  // "Semana 2 · 08/11 a 14/11" → título "SEMANA 2" e as datas numa linha menor
  const [semanaNome, semanaDatas] = periodoSemana.includes(" · ") ? periodoSemana.split(" · ") : [periodoSemana, ""];
  const topo = aba === "mensal" ? "NOVEMBRO" : (semanaNome ?? "").toUpperCase();
  const pct = posicao && posicao > 1 && faltaPro1 && meuValor != null && meuValor + faltaPro1 > 0 ? Math.max(4, Math.min(100, (meuValor / (meuValor + faltaPro1)) * 100)) : null;
  return (
    <section key={aba} aria-label="Desafio Avante" className="vant-desce relative overflow-hidden rounded-2xl border px-4 pt-3.5 pb-3"
      style={{ borderColor: "#3a2c0a", background: "radial-gradient(120% 90% at 50% 0%, rgba(245,181,68,0.30) 0%, #120d04 58%)", boxShadow: "0 0 0 1px rgba(245,184,0,.16), 0 16px 44px -20px rgba(245,184,0,.7)" }}>
      {/* raios atrás do prêmio, girando devagar */}
      <span aria-hidden="true" className="vant-raios absolute pointer-events-none" style={{ left: "50%", top: -170, width: 420, height: 420, transform: "translateX(-50%)", borderRadius: "50%", background: "repeating-conic-gradient(rgba(245,184,0,.10) 0deg 6deg, transparent 6deg 18deg)", maskImage: "radial-gradient(circle, #000 20%, transparent 62%)", WebkitMaskImage: "radial-gradient(circle, #000 20%, transparent 62%)" }} />
      <span className="absolute inset-0 pointer-events-none vant-varre" />

      <p className="relative text-center tracking-[0.3em] text-[11px]" style={{ color: OURO_CLARO }}>DESAFIO AVANTE · {topo}</p>
      {aba === "semanal" && semanaDatas && <p className="relative text-center text-[11px] font-bold mt-0.5" style={{ color: "#b9b3a6" }}>{semanaDatas} · fecha sábado 23:59</p>}

      <div className="relative flex flex-col items-center mt-2">
        <span className="vant-estoura orbis-float w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(245,184,0,.14)", boxShadow: "0 0 26px rgba(245,184,0,.45), inset 0 0 0 1px rgba(245,184,0,.35)" }}>
          {aba === "mensal" ? <Trophy className="w-7 h-7" style={{ color: OURO }} /> : <Zap className="w-7 h-7" style={{ color: OURO }} fill={OURO} strokeWidth={0} />}
        </span>
        <p className="vant-respira orbis-num font-black leading-none mt-2 tabular-nums" style={{ fontSize: 48, color: OURO, letterSpacing: "-1px" }}>{brl0(valor)}</p>
        <p className="vant-sobe text-[13.5px] font-bold mt-1 text-white" style={{ animationDelay: ".25s" }}>{premio.texto}</p>
      </div>

      <div className="relative mt-3">
        {premio.antes
          ? <p className="vant-sobe text-center text-[12px] font-bold py-1.5" style={{ color: "#b9b3a6", animationDelay: ".35s" }}>Começa <b className="text-white">1º de novembro</b>. Até lá, o ranking continua valendo.</p>
          : <Cronometro aba={aba} fimSemana={fimSemana} />}
      </div>

      {!premio.antes && typeof posicao === "number" && posicao > 0 && (
        <div className="relative mt-3 vant-sobe" style={{ animationDelay: ".55s" }}>
          <div className={`flex items-center justify-between text-[12px] ${subiu ? "vant-pisca" : ""}`} style={{ color: "#b9b3a6" }}>
            <span>Você está em <b className="text-white">{posicao}º</b></span>
            {posicao === 1
              ? <span style={{ color: OURO }}><b>Segura até o fim: o prêmio é seu.</b></span>
              : faltaPro1 && faltaPro1 > 0 ? <span>faltam <b style={{ color: OURO }}>{brl0(faltaPro1)}</b> pro 1º</span> : null}
          </div>
          {pct !== null && (
            <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
              <div className="vant-enche h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, #b39500, ${OURO})`, boxShadow: "0 0 10px rgba(245,184,0,.6)" }} />
            </div>
          )}
        </div>
      )}

      <div className="relative mt-3 vant-sobe" style={{ animationDelay: ".65s" }}>{abas(true)}</div>
    </section>
  );
}
