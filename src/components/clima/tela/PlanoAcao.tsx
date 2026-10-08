/* 5 · PLANO DE AÇÃO DO DIA — timeline vertical (v2, 08/10). Amarelo = esperar,
   verde = vender, cinza (vazado) = reavaliar, vermelho = parar/abrigo.
   Entra em cascata (~250ms por passo). Sai das mesmas janelas do hora a hora. */
import type { Passo } from "../decisao";
import { COR, Titulo } from "./comum";
import { CLIMA } from "./paleta";

function corDoPasso(p: Passo): { cor: string; vazado: boolean } {
  if (p.acao === "procura abrigo") return { cor: CLIMA.risco, vazado: false };
  if (p.acao === "sair pra vender") return { cor: CLIMA.bom, vazado: false };
  if (p.acao === "espera") return { cor: CLIMA.instavel, vazado: false };
  return { cor: "#9a948a", vazado: true };
}

export function PlanoAcao({ passos }: { passos: Passo[] }) {
  if (passos.length === 0) return null;
  return (
    <section aria-label="Plano de ação do dia">
      <Titulo>Plano de ação do dia</Titulo>
      <ol className="relative pl-1">
        {passos.map((p, i) => {
          const { cor, vazado } = corDoPasso(p);
          return (
            <li key={`${p.quando}-${i}`} className="relative flex gap-3.5 pb-5 last:pb-0 animate-in fade-in slide-in-from-left-2 fill-mode-both duration-300"
              style={{ animationDelay: `${i * 90}ms` }}>
              {i < passos.length - 1 && <span className="absolute left-[7px] top-[18px] bottom-0 w-[2px] rounded-full" style={{ background: `linear-gradient(${cor}88, rgba(255,255,255,.08))` }} aria-hidden />}
              <i className="relative mt-[3px] w-4 h-4 rounded-full shrink-0" aria-hidden
                style={vazado ? { border: `2px solid ${cor}`, background: "#0b0b0d" } : { background: cor, boxShadow: `0 0 0 5px ${cor}22, 0 0 16px ${cor}55` }} />
              <div className="min-w-0">
                <p className="text-[14px] font-black uppercase tracking-[.04em] leading-snug">
                  <span className="tabular-nums" style={{ color: COR.texto }}>{p.quando}</span>
                  <span style={{ color: COR.mute }}> — </span>
                  <span style={{ color: vazado ? "#c9c3b8" : cor }}>{p.acao}</span>
                </p>
                <p className="text-[14px] leading-snug mt-1" style={{ color: COR.sub }}>{p.texto}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
