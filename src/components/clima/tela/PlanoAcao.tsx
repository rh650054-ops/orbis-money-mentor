/* 7 · PLANO DE AÇÃO DE HOJE — agenda curta, uma ação por linha. Sai das mesmas
   janelas e do mesmo hora a hora (decisao.ts), cruzando meta e contas. */
import type { Passo } from "../decisao";
import { COR_NIVEL } from "../decisao";
import { COR, Cartao, Titulo } from "./comum";

export function PlanoAcao({ passos }: { passos: Passo[] }) {
  if (passos.length === 0) return null;
  return (
    <section aria-label="Plano de ação de hoje">
      <Titulo>Plano de ação de hoje</Titulo>
      <Cartao>
        <ol className="flex flex-col">
          {passos.map((p, i) => (
            <li key={`${p.quando}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
              {i < passos.length - 1 && <span className="absolute left-[5px] top-4 bottom-0 w-px" style={{ background: "rgba(255,255,255,.1)" }} aria-hidden />}
              <i className="relative mt-1.5 w-[11px] h-[11px] rounded-full shrink-0" style={{ background: COR_NIVEL[p.nivel], boxShadow: `0 0 0 4px ${COR_NIVEL[p.nivel]}22` }} aria-hidden />
              <div className="min-w-0">
                <p className="text-[15px] font-bold leading-snug" style={{ color: COR.texto }}>
                  <span className="tabular-nums">{p.quando}</span> <span style={{ color: COR.mute }}>—</span> <span style={{ color: COR_NIVEL[p.nivel] }}>{p.acao}</span>
                </p>
                <p className="text-[13.5px] leading-snug mt-0.5" style={{ color: COR.sub }}>{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </Cartao>
    </section>
  );
}
