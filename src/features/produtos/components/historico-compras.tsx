/* Histórico de compras (25/11, Rick: "cada aba com sua responsabilidade"). It moved from the Estoque tab
   to Mercado, where purchases are registered: the same list (last 2, "Ver histórico" for the rest) and
   the same purchase detail with edit. Nothing about the purchases changed. */
import { useState } from "react";
import { ComprasRecentes } from "./compras-recentes";
import { CompraDetalhe } from "./compra-detalhe";

export function HistoricoCompras({ userId, onEditar }: { userId: string | undefined; onEditar: (id: string) => void }) {
  const [aberta, setAberta] = useState<string | null>(null);
  return (
    <>
      <ComprasRecentes userId={userId} onAbrir={setAberta} />
      <CompraDetalhe id={aberta} onFechar={() => setAberta(null)} onEditar={(id) => { setAberta(null); onEditar(id); }} />
    </>
  );
}
