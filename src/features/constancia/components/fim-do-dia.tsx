/* End of the day (Rick, 05/11): after the DEFCON 4 closes, the Home opens with this full screen —
   the flame charges, the old number flies off, the new one bounces in with sparks and sound, the
   week fills its checks one by one, the Vant speaks, "Combinado!". Frozen before today: the ice
   cracks and the flame comes back. Sequence copied from Duolingo's streak screen. */
import { useEffect, useRef, useState } from "react";
import type { Constancia } from "../types";
import { tocar } from "../lib/som";
import { ehMarco, nomeDoMarco, proximoMarco } from "../lib/marcos";
import { ChamaIcone } from "./chama-icone";

type Fase = "carregando" | "virou" | "semana" | "feito";
const LETRAS = ["S", "T", "Q", "Q", "S", "S", "D"];

export function numerosDoDia(c: Constancia): { velho: number; novo: number; gelo: boolean; resgate: boolean } {
  const resgate = c.estado === "resgate";
  const novo = resgate ? c.guardados + c.resgate : c.dias;
  const velho = c.antes.estado === "resgate" ? c.antes.guardados + c.antes.resgate : c.antes.dias;
  return { velho: Math.min(velho, novo), novo, gelo: c.antes.estado === "congelada" || c.antes.estado === "perdeu", resgate };
}

export function FimDoDia({ c, hoje, onFechar }: { c: Constancia; hoje: string; onFechar: () => void }) {
  const [fase, setFase] = useState<Fase>("carregando");
  const [checks, setChecks] = useState(0);
  const timers = useRef<number[]>([]);
  const { velho, novo, gelo, resgate } = numerosDoDia(c);

  // this week (Mon..Sun) from the month calendar; today's check is the last to come in
  const d0 = new Date(`${hoje}T12:00:00`); const dow = (d0.getDay() + 6) % 7;
  const semana = LETRAS.map((letra, i) => {
    const d = new Date(d0); d.setDate(d0.getDate() - dow + i);
    const iso = d.toLocaleDateString("en-CA");
    const s = c.mes.find((x) => x.d === iso)?.s ?? (iso === hoje ? "hoje" : "futuro");
    return { letra, iso, feito: s === "trabalhou" || iso === hoje, folga: s === "folga", hoje: iso === hoje, ordem: i };
  });
  const feitosAntes = semana.filter((d) => d.feito && !d.hoje).length;

  useEffect(() => {
    const lista = timers.current;
    const t = (fn: () => void, ms: number) => lista.push(window.setTimeout(fn, ms));
    tocar(gelo ? "gelo" : "carga");
    t(() => { tocar("virou"); setFase("virou"); }, 700);
    t(() => { setFase("semana"); setChecks(feitosAntes); }, 1500);
    t(() => { tocar("check"); setChecks(feitosAntes + 1); }, 2000);
    t(() => setFase("feito"), 2500);
    return () => lista.forEach(clearTimeout);
  }, [gelo, feitosAntes]);

  const virou = fase !== "carregando";
  const marco = ehMarco(novo);
  const prox = proximoMarco(novo);
  const fala = marco ? `Marco de ${nomeDoMarco(novo)}! ${novo} dias seguidos na rua.`
    : resgate ? `Resgate: ${c.resgate} de 7. Segura firme que ela volta inteira.`
    : gelo ? "Descongelou! Sabia que você ia voltar. Repete amanhã?"
    : `Sabia que você ia voltar! Faltam ${prox - novo} pro marco de ${prox}.`;
  const num = (n: number, ativo: boolean) => ({
    position: "absolute" as const, left: 0, right: 0, margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: "-.04em", lineHeight: "92px",
    transform: `translateY(${ativo ? (virou ? 0 : 100) : (virou ? -100 : 0)}px) scale(${ativo ? (virou ? 1.9 : 1.1) : (virou ? 1.3 : 1.9)})`,
    opacity: ativo ? (virou ? 1 : 0) : (virou ? 0 : 1), color: ativo ? "#F9CE63" : "#57534A",
    transition: "transform .55s cubic-bezier(.34,1.56,.64,1), opacity .4s",
  });

  return (
    <div role="dialog" aria-label="Mais um dia de constância" className="fixed inset-0 z-[80] flex flex-col items-center text-center px-6 pt-14 pb-8 overflow-hidden text-foreground"
      style={{ background: virou ? "radial-gradient(120% 70% at 50% 36%, #3a2306 0%, #120a01 55%, #000 100%)" : "#000", transition: "background .9s" }}>
      <div className="h-[92px] w-full flex items-end justify-center">
        {fase === "feito" && (
          <div className="vant-fala relative max-w-[300px] rounded-2xl px-4 py-3 text-[14.5px] leading-snug" style={{ background: "#111", border: "1.5px solid rgba(255,255,255,.12)" }}>
            {fala}
            <span className="absolute left-1/2 -bottom-2 w-3.5 h-3.5 -ml-[7px] rotate-45" style={{ background: "#111", borderRight: "1.5px solid rgba(255,255,255,.12)", borderBottom: "1.5px solid rgba(255,255,255,.12)" }} />
          </div>
        )}
      </div>
      <div className="relative w-[220px] h-[214px] flex items-center justify-center">
        {virou && <><span className="vant-anel" /><span className="vant-anel vant-anel2" />{Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2; const r = 110 + (i % 3) * 22;
          return <span key={i} className="vant-faisca" style={{ ["--dx" as string]: `${Math.round(Math.cos(a) * r)}px`, ["--dy" as string]: `${Math.round(Math.sin(a) * r)}px`, animationDelay: `${(i % 4) * 0.04}s` }} />;
        })}</>}
        <div className={fase === "carregando" ? "vant-carregar" : "vant-respira"}>
          <ChamaIcone size={140} look={virou ? "acesa" : gelo ? "gelo" : "apagada"} brilho={virou} />
        </div>
      </div>
      <div className="relative w-[240px] h-[92px] overflow-hidden" aria-live="polite">
        <p className="orbis-num" style={num(velho, false)}>{velho}</p>
        <p className="orbis-num" style={num(novo, true)}>{novo}</p>
      </div>
      <p className="text-[17px] font-bold mt-0.5" style={{ color: virou ? "#F9CE63" : "#57534A", transition: "color .5s" }}>{resgate ? "dias (em resgate)" : "dias de constância"}</p>
      <div className="h-[84px] w-full flex items-center justify-center mt-4">
        {(fase === "semana" || fase === "feito") && (
          <div className="vant-entra flex gap-[9px]" aria-label="Sua semana">
            {semana.map((d) => {
              const on = d.feito && (d.hoje ? checks > feitosAntes : semana.filter((x) => x.feito && !x.hoje && x.ordem <= d.ordem).length <= checks);
              return (
                <div key={d.iso} className="flex flex-col items-center gap-[7px]">
                  <span className="text-[11px] font-bold" style={{ color: d.hoje ? "#f5b800" : "#7e7869" }}>{d.letra}</span>
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center box-border ${on && d.hoje ? "vant-check" : ""}`}
                    style={on ? { background: "linear-gradient(180deg,#ffc63a,#f5b800)", boxShadow: "0 0 12px rgba(245,184,0,.35)" } : d.folga ? { border: "1.6px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.03)" } : { border: "1.6px solid rgba(255,255,255,.13)" }}>
                    {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A1200" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 7" /></svg>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="mt-auto w-full">
        {fase === "feito" && (
          <button type="button" onClick={onFechar} className="vant-entra w-full h-[54px] rounded-[14px] text-[16px] font-bold active:scale-[0.97]" style={{ background: "linear-gradient(180deg,#ffc63a,#f5b800)", color: "#1A1200" }}>Combinado!</button>
        )}
      </div>
    </div>
  );
}
