/* ============================================================
   TETO POR CATEGORIA (05/10/2026, pedido do Rick): "uma opção definindo o
   teto de gastos — fast food, esse é o teto; mercado, esse é o teto".
   Folha que abre do Rastreador: lista toda categoria de saída, mostra quanto
   ele gasta normalmente (média dos 3 meses) como sugestão e deixa digitar o
   teto do mês. Vazio = sem teto (volta a valer o "seu normal").
   Grava em financas_tetos via financas_teto_definir().
   ============================================================ */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { toast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";

const GOLD = "#F5B800";
const MUTE = "#8a857c";

interface Item { categoria: string; rotulo: string; icone: string; teto: number | null }
type Rpc = { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
const sb = supabase as unknown as Rpc;
const reais = (v: number) => formatCurrency(v).replace(/,00$/, "");

export function TetosGastos({ historico, onFechar, onSalvo }: {
  /** quanto ele gasta por mês em cada categoria (o "normal"), pra sugerir */
  historico: Record<string, number>;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    sb.rpc("financas_tetos_lista").then(({ data, error }) => {
      if (error) { avisar.erro("Tetos: listar", error); return; }
      if (!vivo) return;
      const lista = (data as Item[]) ?? [];
      // primeiro o que ele mais gasta; quem já tem teto vem junto no topo
      lista.sort((a, b) => (b.teto ?? historico[b.categoria] ?? 0) - (a.teto ?? historico[a.categoria] ?? 0));
      setItens(lista);
      setValores(Object.fromEntries(lista.map((i) => [i.categoria, i.teto ? String(Math.round(i.teto)) : ""])));
    });
    return () => { vivo = false; };
  }, [historico]);

  const salvar = async () => {
    if (!itens) return;
    setSalvando(true);
    const mudou = itens.filter((i) => (valores[i.categoria] ?? "") !== (i.teto ? String(Math.round(i.teto)) : ""));
    let erros = 0;
    for (const i of mudou) {
      const n = Number((valores[i.categoria] ?? "").replace(/\D/g, ""));
      const { error } = await sb.rpc("financas_teto_definir", { p_categoria: i.categoria, p_valor: n > 0 ? n : null });
      if (error) { erros++; avisar.erro("Tetos: salvar", error); }
    }
    setSalvando(false);
    if (erros) { toast({ title: "Não consegui salvar todos", description: "Tenta de novo em instantes.", variant: "destructive" }); return; }
    toast({ title: mudou.length ? "Tetos salvos" : "Nada mudou", description: mudou.length ? "O rastreador já compara cada gasto com o teto que você definiu." : undefined });
    onSalvo();
    onFechar();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70" onClick={onFechar}>
      <div className="w-full max-w-md max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl" style={{ background: "#0f0f10", border: "1px solid #1f1e22" }}
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="tetos-titulo">
        <div className="flex items-start justify-between gap-2 p-4 pb-2">
          <div>
            <p className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>TETO DE GASTOS</p>
            <p id="tetos-titulo" className="text-[16px] font-extrabold mt-1">Quanto você topa gastar por mês em cada coisa?</p>
            <p className="text-[11.5px] mt-1" style={{ color: MUTE }}>Deixa vazio onde não quer teto. O cinza é quanto você costuma gastar.</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ color: "#b9b3a6" }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4">
          {!itens ? (
            <p className="text-[12px] py-6 text-center" style={{ color: MUTE }}>Carregando…</p>
          ) : itens.map((i) => {
            const h = historico[i.categoria] ?? 0;
            return (
              <label key={i.categoria} className="flex items-center gap-2.5 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
                <span aria-hidden className="text-[18px] w-6 text-center">{i.icone}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-extrabold truncate">{i.rotulo}</span>
                  <span className="block text-[10.5px]" style={{ color: MUTE }}>{h > 0 ? `costuma gastar ${reais(h)}/mês` : "sem histórico"}</span>
                </span>
                <span className="flex items-center rounded-xl px-2.5 h-10 w-[112px]" style={{ background: "#18181b", border: `1px solid ${valores[i.categoria] ? "rgba(245,184,0,.5)" : "#26262a"}` }}>
                  <span className="text-[12px] font-bold mr-1" style={{ color: MUTE }}>R$</span>
                  <input inputMode="numeric" aria-label={`Teto de ${i.rotulo}`} value={valores[i.categoria] ?? ""}
                    placeholder={h > 0 ? String(Math.round(h)) : "—"}
                    onChange={(e) => setValores((v) => ({ ...v, [i.categoria]: e.target.value.replace(/\D/g, "").slice(0, 7) }))}
                    className="w-full bg-transparent outline-none text-[14px] font-black tabular-nums placeholder:text-[#4a4741]" />
                </span>
              </label>
            );
          })}
        </div>
        <div className="p-4 pt-3 pb-safe">
          <button type="button" onClick={salvar} disabled={!itens || salvando}
            className="w-full h-12 rounded-2xl text-[14px] font-black disabled:opacity-60"
            style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
            {salvando ? "Salvando…" : "SALVAR TETOS"}
          </button>
        </div>
      </div>
    </div>
  );
}
