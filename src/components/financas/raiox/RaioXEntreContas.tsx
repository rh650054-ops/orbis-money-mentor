/* Raio-X do extrato — "Entre suas contas": dinheiro que só mudou de lugar (Itaú → PicPay,
   InfinitePay → Itaú, cofrinho/aplicação). Não entra em "saiu" nem em "entrou" — senão
   a mesma grana aparece duas vezes. Se algo aqui não for conta sua, "não é minha" tira. */
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { RaioXLancamento } from "@/hooks/useRaioXExtrato";
import { toast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";
import { diaCurto, moeda, mesNome } from "./raiox-utils";

const RESERVA = /cofrinho|caixinha|aplica|resgate|poupan|cdb|rdb|investimento|tesouro/i;

interface Props {
  mes: string;
  lista: (categoria: string | null, tipo?: "saida" | "entrada" | null) => Promise<RaioXLancamento[]>;
  mover: (id: string, categoria: string) => Promise<number>;
}

export default function RaioXEntreContas({ mes, lista, mover }: Props) {
  const [itens, setItens] = useState<RaioXLancamento[] | null>(null);
  const [movendo, setMovendo] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setItens(null);
    lista("__entre_contas", null).then((r) => { if (vivo) setItens(r); });
    return () => { vivo = false; };
  }, [lista, mes]);

  // Cada transferência pareada aparece uma vez (pela saída); entrada sem par aparece sozinha.
  const linhas = useMemo(() => (itens ?? []).filter((l) => l.tipo === "saida" || !l.par_banco), [itens]);
  const total = useMemo(() => linhas.reduce((s, l) => s + l.valor, 0), [linhas]);

  const naoEMinha = async (l: RaioXLancamento) => {
    setMovendo(l.id);
    const n = await mover(l.id, l.tipo === "saida" ? "pix_pessoas" : "pix_recebido");
    setMovendo(null);
    if (n > 0) {
      setItens((prev) => (prev ?? []).filter((x) => x.id !== l.id));
      toast({ title: l.tipo === "saida" ? "Voltou pros gastos" : "Voltou pras entradas", description: "Agora conta no total do mês." });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-[22px] font-black tracking-tight text-foreground">Entre suas contas</h1>
        <p className="text-[12.5px] mt-1.5 leading-snug" style={{ color: "#a9a49c" }}>
          {itens === null ? "…" : `${moeda(total)} em ${mesNome(mes)} só mudaram de lugar.`} Isso fica fora do "saiu" e do "entrou" pra não contar duas vezes. Se algo aqui não é conta sua, toca no ✕.
        </p>
      </div>

      <section className="rounded-2xl border px-3.5" style={{ background: "#131211", borderColor: "rgba(255,255,255,.07)" }}>
        {itens === null ? (
          <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#FFC800" }} /></div>
        ) : linhas.length === 0 ? (
          <p className="py-4 text-[12.5px]" style={{ color: "#a9a49c" }}>Nenhuma transferência entre contas suas nesse mês.</p>
        ) : linhas.map((l, i) => {
          const d = diaCurto(l.data);
          // Cofrinho/aplicação/resgate: o "outro lado" é a reserva dentro do mesmo banco.
          const reserva = RESERVA.test(l.descricao) ? "cofrinho" : null;
          const rota = l.tipo === "saida"
            ? `${l.banco ?? "?"} → ${l.par_banco ?? reserva ?? "conta sua"}`
            : `${reserva ?? "conta sua"} → ${l.banco ?? "?"}`;
          return (
            <div key={l.id} className="flex items-center gap-2.5 py-2.5" style={{ borderTop: i ? "1px solid rgba(255,255,255,.07)" : undefined }}>
              <span className="w-[34px] text-center leading-tight shrink-0">
                <b className="block text-[14px] text-foreground">{d.dia}</b>
                <span className="block text-[10.5px] font-extrabold" style={{ color: "#7e7869" }}>{d.sem}</span>
              </span>
              <div className="flex-1 min-w-0">
                <b className="block text-[13px] text-foreground truncate">{rota}</b>
                <span className="block text-[11px] font-semibold truncate" style={{ color: "#7e7869" }}>{l.descricao}</span>
              </div>
              <span className="text-[14px] font-black tabular-nums text-foreground">{formatCurrency(l.valor)}</span>
              <button type="button" disabled={movendo !== null} onClick={() => naoEMinha(l)} aria-label="Não é conta minha" title="Não é conta minha"
                className="w-7 h-7 rounded-lg border shrink-0 text-[12px] font-black disabled:opacity-50"
                style={{ color: "#7e7869", borderColor: "rgba(255,255,255,.08)" }}>
                {movendo === l.id ? "…" : "✕"}
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
