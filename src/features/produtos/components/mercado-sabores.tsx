/* Fim do "Tô no mercado" (26/10/2026): o produto tem sabores → "dá pra fazer N, divide
   entre os sabores". Os extras de cada sabor baixam e o estoque por sabor sobe. */
import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { useDistribuirSaboresMutation, useSaboresQuery } from "../api/use-sabores";
import { dividirIgual } from "../lib/sabores";
import { BotaoOuro } from "./quiz-casca";
import { SaboresContadores } from "./sabores-contadores";

const OURO = "#F5B800";

export function MercadoSabores({ produtoId, nome, unidades }: { produtoId: string; nome: string; unidades: number }) {
  const sabores = useSaboresQuery(produtoId);
  const distribuir = useDistribuirSaboresMutation();
  const [valores, setValores] = useState<Record<string, number> | null>(null);
  const [feito, setFeito] = useState(false);
  const lista = sabores.data ?? [];
  if (lista.length === 0 || unidades <= 0) return null;
  const v = valores ?? Object.fromEntries(lista.map((s, i) => [s.id, dividirIgual(unidades, lista.length)[i] ?? 0]));
  const total = lista.reduce((s, x) => s + (v[x.id] ?? 0), 0);
  if (feito) {
    return (
      <div className="rounded-[14px] px-3 py-2.5 flex flex-col gap-1" style={{ background: "rgba(74,222,128,.07)", border: "1px solid rgba(74,222,128,.35)" }}>
        <span className="text-[13px] font-black inline-flex items-center gap-1.5"><Check className="w-4 h-4" style={{ color: "#4ADE80" }} /> Dividido por sabor</span>
        <span className="text-[12.5px] font-bold" style={{ color: "#b9b3a6" }}>{lista.map((s) => `${s.emoji} ${v[s.id] ?? 0}`).join(" · ")}</span>
      </div>
    );
  }
  return (
    <div className="rounded-[14px] px-3 py-2.5 flex flex-col gap-1" style={{ background: "#121211", border: `1px solid ${OURO}55` }}>
      <span className="text-[10px] font-black tracking-[.14em]" style={{ color: OURO }}>QUANTAS DE CADA SABOR?</span>
      <span className="text-[12px] font-bold" style={{ color: "#b9b3a6" }}>A base dá pra {unidades} {nome.toLowerCase()}. Divide entre os sabores:</span>
      <SaboresContadores sabores={lista} valores={v} maximo={unidades} onMudar={(id, n) => setValores({ ...v, [id]: n })} />
      <BotaoOuro disabled={total <= 0 || total > unidades || distribuir.isPending}
        onClick={() => distribuir.mutate({ produto: produtoId, sabores: lista.map((s) => ({ id: s.id, unidades: v[s.id] ?? 0 })) }, {
          onSuccess: () => setFeito(true),
          onError: (e) => toast({ title: "Não consegui dividir", description: String((e as Error).message ?? "").slice(0, 120), variant: "destructive" }),
        })}>
        {distribuir.isPending ? "GUARDANDO…" : "CONFIRMAR SABORES"}
      </BotaoOuro>
    </div>
  );
}
