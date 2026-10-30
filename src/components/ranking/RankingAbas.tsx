/* DESAFIO AVANTE — o painel do prêmio no topo do Ranking (Rick, 29/10/2026).
   Um painel só, no visual do pódio: o prêmio da aba (R$ 500 no Mensal, R$ 50 no Semanal),
   o cronômetro até fechar, onde a pessoa está e quanto falta pro 1º, e as abas
   Mensal | Semanal dentro dele. Fora da janela do desafio vira só as abas.
   Motion (30/10): entrada uma vez (painel desce, emblema estoura, número conta até o prêmio,
   blocos sobem, barra enche), ambiente discreto (raios giram, número respira, brilho varre
   a cada 7 s, o segundo vira), última hora em vermelho, subiu de posição pisca dourado.
   Visual (30/10, referência do Rick): cada aba com identidade própria — Mensal ouro com coroa,
   Semanal azul elétrico com moeda de raio —, medalhão 3D, valor metálico, abas no topo, regras. */
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Crown, ShieldCheck, Zap } from "lucide-react";
import { premioDaAba, PREMIO_FIM, type Aba } from "./premiacao";
import { rgba, TEMAS, type TemaDesafio } from "./desafio-tema";
import { DesafioEmblema } from "./desafio-emblema";
import { DesafioRegras } from "./desafio-regras";

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

function Cronometro({ aba, fimSemana, tema }: { aba: Aba; fimSemana: string; tema: TemaDesafio }) {
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
    <div>
      <p className="text-center text-[10px] font-black tracking-[.24em] mb-1.5" style={{ color: urgente ? "#ff8a8a" : rgba(tema, 0.85) }}>{urgente ? "ÚLTIMA HORA" : "TERMINA EM"}</p>
      <div className="grid grid-cols-4 gap-1.5" aria-label="Fecha em">
        {partes.map(([v, k, vira], i) => (
          <div key={k} className={`vant-sobe rounded-[12px] py-2 text-center overflow-hidden ${urgente ? "vant-urgente" : ""}`}
            style={{ background: `linear-gradient(180deg, ${rgba(tema, 0.1)}, rgba(0,0,0,.5))`, border: `1px solid ${urgente ? "rgba(242,70,90,.5)" : rgba(tema, 0.22)}`, animationDelay: `${0.35 + i * 0.07}s` }}>
            <Digito v={v} vira={vira} />
            <p className="text-[9px] font-bold tracking-[.12em] uppercase mt-0.5" style={{ color: urgente ? "#ff8a8a" : "#b9b3a6" }}>{k}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Abas({ aba, onAba }: { aba: Aba; onAba: (a: Aba) => void }) {
  return (
    <div role="tablist" aria-label="Período do ranking" className="flex gap-1 p-1 rounded-[16px]" style={{ background: "#121211", border: "1px solid rgba(255,255,255,.08)" }}>
      {(["mensal", "semanal"] as Aba[]).map((a) => {
        const on = aba === a; const t = TEMAS[a]; const Icone = a === "mensal" ? Crown : Zap;
        return (
          <button key={a} type="button" role="tab" aria-selected={on} onClick={() => onAba(a)}
            className="flex-1 h-10 rounded-[12px] text-[13.5px] font-black transition-all flex items-center justify-center gap-1.5"
            style={on ? { background: rgba(t, 0.16), color: t.claro, boxShadow: `inset 0 0 0 1px ${rgba(t, 0.7)}, 0 0 16px ${rgba(t, 0.25)}` } : { color: "#8f897c" }}>
            <Icone className="w-4 h-4" fill={on ? t.cor : "none"} strokeWidth={on ? 1.6 : 2} />
            {a === "mensal" ? "Mensal" : "Semanal"}
          </button>
        );
      })}
    </div>
  );
}

export function RankingAbas({ aba, onAba, hoje, periodoSemana, fimSemana, posicao, faltaPro1, meuValor }: {
  aba: Aba; onAba: (a: Aba) => void; hoje: string; periodoSemana: string; fimSemana: string;
  /** the viewer's place, how much to the 1st and his own total — the hook that sends him back to the street */
  posicao?: number | null; faltaPro1?: number | null; meuValor?: number | null;
}) {
  const premio = premioDaAba(aba, hoje);
  const tema = TEMAS[aba];
  const valor = useContagem(premio?.valor ?? 0);
  const [regras, setRegras] = useState(false);
  // subiu de posição desde a última leitura → a linha pisca
  const posAnterior = useRef<number | null>(null);
  const [subiu, setSubiu] = useState(false);
  useEffect(() => {
    if (typeof posicao === "number" && posAnterior.current !== null && posicao < posAnterior.current) { setSubiu(true); const t = setTimeout(() => setSubiu(false), 1300); return () => clearTimeout(t); }
    posAnterior.current = typeof posicao === "number" ? posicao : null;
  }, [posicao]);

  if (!premio) {
    return (
      <div className="space-y-2.5">
        <Abas aba={aba} onAba={onAba} />
        {aba === "semanal" && <p className="text-center text-[12px] font-bold" style={{ color: "#b9b3a6" }}>{periodoSemana} · fecha sábado 23:59</p>}
      </div>
    );
  }

  // "Semana 2 · 08/11 a 14/11" → "DESAFIO DA SEMANA 2" e as datas numa linha menor
  const [semanaNome, semanaDatas] = periodoSemana.includes(" · ") ? periodoSemana.split(" · ") : [periodoSemana, ""];
  const titulo = aba === "mensal" ? tema.titulo : `DESAFIO DA ${(semanaNome ?? "").toUpperCase()}`;
  const linha = aba === "mensal" ? "01/11 a 30/11 · fecha dia 30, 23:59" : `${semanaDatas ? semanaDatas + " · " : ""}fecha sábado 23:59`;
  const pct = posicao && posicao > 1 && faltaPro1 && meuValor != null && meuValor + faltaPro1 > 0 ? Math.max(4, Math.min(100, (meuValor / (meuValor + faltaPro1)) * 100)) : null;
  return (
    <div className="space-y-2.5">
      <Abas aba={aba} onAba={onAba} />
      {/* moldura em degradê na cor da aba */}
      <div key={aba} className="vant-desce rounded-[22px] p-[1.5px]"
        style={{ background: `linear-gradient(160deg, ${tema.claro} 0%, ${rgba(tema, 0.25)} 28%, ${rgba(tema, 0.08)} 60%, ${tema.cor} 100%)`, boxShadow: `0 18px 50px -22px ${rgba(tema, 0.85)}` }}>
        <section aria-label="Desafio Avante" className="relative overflow-hidden rounded-[20.5px] px-4 pt-4 pb-3.5"
          style={{ background: `radial-gradient(120% 75% at 50% 0%, ${rgba(tema, 0.32)} 0%, ${tema.fundo} 60%)`, ["--vant-rgb" as string]: tema.rgb }}>
          <span aria-hidden="true" className="vant-raios absolute pointer-events-none" style={{ left: "50%", top: -150, width: 440, height: 440, transform: "translateX(-50%)", borderRadius: "50%", background: `repeating-conic-gradient(${rgba(tema, 0.12)} 0deg 6deg, transparent 6deg 18deg)`, maskImage: "radial-gradient(circle, #000 18%, transparent 60%)", WebkitMaskImage: "radial-gradient(circle, #000 18%, transparent 60%)" }} />
          <span aria-hidden="true" className="absolute inset-0 pointer-events-none vant-varre" />

          <p className="relative text-center text-[10px] font-black tracking-[.34em]" style={{ color: rgba(tema, 0.8) }}>DESAFIO AVANTE</p>
          <p className="relative text-center text-[15px] font-black tracking-[.14em] text-white mt-1">{titulo}</p>
          <p className="relative text-center text-[11px] font-bold mt-0.5" style={{ color: "#b9b3a6" }}>{linha}</p>

          <div className="relative flex flex-col items-center mt-3">
            <DesafioEmblema aba={aba} tema={tema} />
            <p className="vant-respira orbis-num font-black leading-none mt-4 tabular-nums"
              style={{ fontSize: 54, letterSpacing: "-1.5px", background: `linear-gradient(180deg, #fff 0%, ${tema.claro} 30%, ${tema.cor} 62%, ${tema.escuro} 100%)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{brl0(valor)}</p>
            <p className="vant-sobe text-[13.5px] font-bold mt-1.5 text-white" style={{ animationDelay: ".25s" }}>{tema.quem}</p>
          </div>

          <div className="relative mt-4">
            {premio.antes
              ? <p className="vant-sobe text-center text-[12px] font-bold py-1.5" style={{ color: "#b9b3a6", animationDelay: ".35s" }}>Começa <b className="text-white">1º de novembro</b>. Até lá, o ranking continua valendo.</p>
              : <Cronometro aba={aba} fimSemana={fimSemana} tema={tema} />}
          </div>

          {!premio.antes && typeof posicao === "number" && posicao > 0 && (
            <div className="relative mt-3 vant-sobe rounded-[14px] px-3 py-2.5" style={{ animationDelay: ".55s", background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.07)" }}>
              <div className={`flex items-center justify-between text-[12px] ${subiu ? "vant-pisca" : ""}`} style={{ color: "#b9b3a6" }}>
                <span>Você está em <b className="text-white">{posicao}º</b></span>
                {posicao === 1
                  ? <span style={{ color: tema.cor }}><b>Segura até o fim: o prêmio é seu.</b></span>
                  : faltaPro1 && faltaPro1 > 0 ? <span>faltam <b style={{ color: tema.cor }}>{brl0(faltaPro1)}</b> pro 1º</span> : null}
              </div>
              {pct !== null && (
                <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
                  <div className="vant-enche h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tema.escuro}, ${tema.cor}, ${tema.claro})`, boxShadow: `0 0 10px ${rgba(tema, 0.6)}` }} />
                </div>
              )}
            </div>
          )}

          <button type="button" onClick={() => setRegras(true)} className="relative mt-3 vant-sobe w-full h-11 rounded-[14px] text-[13.5px] font-black flex items-center justify-center gap-1"
            style={{ animationDelay: ".65s", color: tema.claro, background: rgba(tema, 0.1), border: `1px solid ${rgba(tema, 0.45)}` }}>
            Ver regras <ChevronRight className="w-4 h-4" />
          </button>
          <p className="relative mt-2 flex items-center justify-center gap-1 text-[11px]" style={{ color: "#8f897c" }}><ShieldCheck className="w-3.5 h-3.5" /> Premiação sujeita à verificação</p>
        </section>
      </div>
      <DesafioRegras aberto={regras} onFechar={() => setRegras(false)} />
    </div>
  );
}
