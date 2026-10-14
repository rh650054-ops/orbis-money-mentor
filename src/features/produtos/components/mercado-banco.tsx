/* Conferência da compra no banco (Open Finance): acha a saída do extrato com o
   valor da compra e pergunta "é essa?". Sem banco, mostra o que ganharia. */
import { useState } from "react";
import { Landmark, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useBancoDaCompra, useConfirmarBancoMutation, type SaidaBanco } from "../api/use-banco-compra";
import { reais } from "./campos";

const CAIXA = { background: "#0e0e10", border: "1px solid #26241f" };
const quando = (s: SaidaBanco) => {
  const [, m, d] = s.data.split("-");
  return `${d}/${m}${s.hora ? ` às ${s.hora.slice(0, 5).replace(":", "h")}` : ""}`;
};
const nome = (s: SaidaBanco) => (s.comerciante || s.descricao || "Compra no débito").slice(0, 40);

export function MercadoBanco({ compra, onLigar }: { compra: { id: string; total: number; dia: string }; onLigar: () => void }) {
  const q = useBancoDaCompra(compra);
  const confirmar = useConfirmarBancoMutation();
  const [ok, setOk] = useState<SaidaBanco | null>(null);
  const [nenhuma, setNenhuma] = useState(false);

  let corpo: JSX.Element;
  if (compra.total <= 0) {
    corpo = <p className="text-[13px] font-bold" style={{ color: "#b9b3a6" }}>Põe o valor da compra da próxima vez que eu confiro no seu extrato.</p>;
  } else if (q.isLoading) {
    corpo = <p className="text-[13px] font-bold flex items-center gap-2" style={{ color: "#b9b3a6" }}><Loader2 className="w-4 h-4 animate-spin" /> Procurando no seu extrato…</p>;
  } else if (q.isError || !q.data) {
    corpo = (
      <>
        <p className="text-[13px] font-bold" style={{ color: "#b9b3a6" }}>Não consegui olhar seu extrato agora.</p>
        <button type="button" onClick={() => void q.refetch()} disabled={q.isFetching}
          className="self-start h-10 px-4 rounded-[12px] text-[13px] font-black flex items-center gap-2" style={{ background: "#121211", border: "1px solid #3a3833" }}>
          <RefreshCw className={`w-4 h-4 ${q.isFetching ? "animate-spin" : ""}`} /> Tentar de novo
        </button>
      </>
    );
  } else if (!q.data.temBanco) {
    corpo = (
      <>
        <p className="text-[13px] font-bold leading-snug" style={{ color: "#b9b3a6" }}>
          Com o banco ligado, a VANT acha essa compra no seu extrato sozinha e confere se o valor bate.
        </p>
        <button type="button" onClick={onLigar} className="self-start h-10 px-4 rounded-[12px] text-[13px] font-black" style={{ background: "#F5B800", color: "#1A1200" }}>
          Ligar meu banco
        </button>
      </>
    );
  } else if (ok) {
    const dif = ok.valor - compra.total;
    corpo = (
      <div className="flex flex-col gap-1">
        <span className="text-[15px] font-black flex items-center gap-1.5" style={{ color: "#4ADE80" }}><ShieldCheck className="w-4 h-4" /> Conferido no banco</span>
        <span className="text-[13px] font-bold" style={{ color: "#b9b3a6" }}>{nome(ok)} · {reais(ok.valor)} · {quando(ok)}{ok.banco ? ` · ${ok.banco}` : ""}</span>
        {Math.abs(dif) >= 0.01 && (
          <span className="text-[12px] font-bold" style={{ color: "#F5B800" }}>
            No banco saiu {reais(Math.abs(dif))} {dif > 0 ? "a mais" : "a menos"} que o anotado.
          </span>
        )}
      </div>
    );
  } else if ((q.data.candidatos.length === 0) || nenhuma) {
    corpo = (
      <>
        <p className="text-[13px] font-bold leading-snug" style={{ color: "#b9b3a6" }}>
          Ainda não achei {reais(compra.total)} no seu extrato. O banco costuma mostrar a compra em até 1 hora.
        </p>
        <button type="button" onClick={() => { setNenhuma(false); void q.refetch(); }} disabled={q.isFetching}
          className="self-start h-10 px-4 rounded-[12px] text-[13px] font-black flex items-center gap-2" style={{ background: "#121211", border: "1px solid #3a3833" }}>
          <RefreshCw className={`w-4 h-4 ${q.isFetching ? "animate-spin" : ""}`} /> Procurar de novo
        </button>
      </>
    );
  } else {
    corpo = (
      <>
        <p className="text-[13px] font-bold" style={{ color: "#b9b3a6" }}>Achei no seu extrato. É essa?</p>
        {q.data.candidatos.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-[14px] px-3 py-2.5" style={{ background: "#121211", border: "1px solid #26241f" }}>
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="text-[14px] font-black truncate">{nome(s)}</span>
              <span className="text-[12px] font-bold" style={{ color: "#7b766e" }}>{quando(s)}{s.banco ? ` · ${s.banco}` : ""}</span>
            </div>
            <span className="text-[15px] font-black tabular-nums">{reais(s.valor)}</span>
            <button type="button" disabled={confirmar.isPending}
              onClick={() => confirmar.mutate({ compraId: compra.id, saida: s }, { onSuccess: () => setOk(s) })}
              className="h-9 px-3 rounded-[10px] text-[13px] font-black" style={{ background: "#F5B800", color: "#1A1200" }}>
              É essa
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setNenhuma(true)} className="self-start text-[12.5px] font-bold underline" style={{ color: "#7b766e" }}>
          Não é nenhuma dessas
        </button>
      </>
    );
  }

  return (
    <section className="rounded-[18px] px-4 py-3.5 flex flex-col gap-2.5" style={CAIXA} aria-label="Conferência no banco">
      <span className="text-[10.5px] font-black tracking-[.14em] flex items-center gap-1.5" style={{ color: "#F5B800" }}>
        <Landmark className="w-3.5 h-3.5" /> CONFERÊNCIA NO BANCO
      </span>
      {corpo}
    </section>
  );
}
