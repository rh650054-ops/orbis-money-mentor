/* Últimas compras do mercado — tocar abre o detalhe da compra (26/10; antes ia direto pra editar).
   25/11 (Rick): compact — the last 2, and "Ver histórico" opens the rest (nothing is hidden for good). */
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useComprasMercadoQuery } from "../api/use-compra-mercado";
import { reais } from "./campos";

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(",", " ·");

export function ComprasRecentes({ userId, onAbrir }: { userId: string | undefined; onAbrir: (id: string) => void }) {
  const { data } = useComprasMercadoQuery(userId);
  const [tudo, setTudo] = useState(false);
  if (!data || data.length === 0) return null;
  const lista = tudo ? data : data.slice(0, 2);
  return (
    <section className="flex flex-col gap-2 mt-2">
      <span className="text-[10.5px] font-black tracking-[.14em] px-1" style={{ color: "#F5B800" }}>COMPRAS DO MERCADO</span>
      {lista.map((c) => (
        <button key={c.id} type="button" onClick={() => onAbrir(c.id)} className="rounded-[14px] px-3.5 py-2.5 flex items-center gap-3 text-left"
          style={{ background: "#0f0f10", border: "1px solid #26241f" }}>
          <span className="text-xl">🛒</span>
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-sm font-black">{reais(c.total)}</span>
            <span className="text-xs font-bold" style={{ color: "#7b766e" }}>{quando(c.criada_em)} · {c.itens} {c.itens === 1 ? "item" : "itens"}</span>
          </span>
          <span className="text-xs font-black" style={{ color: "#F5B800" }}>ver</span>
          <ChevronRight className="w-4 h-4" style={{ color: "#7b766e" }} />
        </button>
      ))}
      {data.length > 2 && (
        <button type="button" onClick={() => setTudo(!tudo)} className="self-start text-[12.5px] font-extrabold px-1 py-1" style={{ color: "#F5B800" }}>
          {tudo ? "Mostrar menos" : `Ver histórico (${data.length} compras)`}
        </button>
      )}
    </section>
  );
}
