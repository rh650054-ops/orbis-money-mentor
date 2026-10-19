/* Últimas compras do mercado — tocar abre a compra pra editar (Rick, 19/10). */
import { ChevronRight } from "lucide-react";
import { useComprasMercadoQuery } from "../api/use-compra-mercado";
import { reais } from "./campos";

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(",", " ·");

export function ComprasRecentes({ userId, onAbrir }: { userId: string | undefined; onAbrir: (id: string) => void }) {
  const { data } = useComprasMercadoQuery(userId);
  if (!data || data.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 mt-2">
      <span className="text-[10.5px] font-black tracking-[.14em] px-1" style={{ color: "#F5B800" }}>COMPRAS DO MERCADO</span>
      {data.map((c) => (
        <button key={c.id} type="button" onClick={() => onAbrir(c.id)} className="rounded-2xl px-3.5 py-3 flex items-center gap-3 text-left"
          style={{ background: "#0f0f10", border: "1px solid #26241f" }}>
          <span className="text-xl">🛒</span>
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-sm font-black">{reais(c.total)}</span>
            <span className="text-xs font-bold" style={{ color: "#7b766e" }}>{quando(c.criada_em)} · {c.itens} {c.itens === 1 ? "item" : "itens"}</span>
          </span>
          <span className="text-xs font-black" style={{ color: "#F5B800" }}>editar</span>
          <ChevronRight className="w-4 h-4" style={{ color: "#7b766e" }} />
        </button>
      ))}
    </section>
  );
}
