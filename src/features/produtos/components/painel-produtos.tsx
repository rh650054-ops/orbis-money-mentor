/* Produtos e Estoque (24/11/2026): the panel pieces around the list. Summary numbers, the area
   navigation (Produtos / Estoque are tabs here; Produção and Mercado open their existing screens) and the
   "Registrar compra" action at the end of the list (no longer a floating button over the content). */
import { useNavigate } from "react-router-dom";
import { Box, ChevronRight, Factory, Layers, ShoppingCart } from "lucide-react";

const OURO = "#F5B800";

export function ResumoPainel({ produtos, unidades, podeProduzir, calculando }: { produtos: number; unidades: number; podeProduzir: number; calculando: boolean }) {
  // mockup layout: icon beside the label, the number under it; ~70 px tall
  const Card = ({ Icone, rotulo, valor, sufixo, cor }: { Icone: typeof Box; rotulo: string; valor: string; sufixo?: string; cor?: string }) => (
    <div className="rounded-[14px] px-2 min-[380px]:px-2.5 py-2.5 flex flex-col gap-1.5 justify-between min-w-0" style={{ background: "#121212", border: "1px solid #2a2722" }}>
      <span className="flex max-[379px]:flex-col items-start gap-1.5">
        <Icone className="w-[18px] h-[18px] shrink-0 mt-[1px]" style={{ color: cor ?? OURO }} strokeWidth={2} />
        <span className="text-[10.5px] min-[380px]:text-[11px] font-semibold leading-[1.2]" style={{ color: "#d8d2c4" }}>{rotulo}</span>
      </span>
      <span className="flex flex-wrap items-baseline gap-x-1 leading-none min-[380px]:pl-6">
        <span className="text-[22px] font-extrabold tabular-nums tracking-tight" style={{ color: cor ?? "#F4F1EA" }}>{valor}</span>
        {sufixo && <span className="text-[11.5px] font-bold" style={{ color: cor ?? "#F4F1EA" }}>{sufixo}</span>}
      </span>
    </div>
  );
  return (
    <div className="grid grid-cols-3 gap-2">
      <Card Icone={Box} rotulo="Produtos cadastrados" valor={String(produtos)} />
      <Card Icone={Layers} rotulo="Unidades em estoque" valor={unidades.toLocaleString("pt-BR")} />
      {/* products whose ingredients cover at least one batch (never a sum of flavours sharing stock) */}
      <Card Icone={Factory} rotulo="Pode produzir hoje" valor={calculando ? "…" : String(podeProduzir)} sufixo={podeProduzir === 1 ? "produto" : "produtos"} cor="#3DD68C" />
    </div>
  );
}

export type Aba = "produtos" | "estoque";
export function NavPainel({ aba, alerta, onAba }: { aba: Aba; alerta: boolean; onAba: (a: Aba) => void }) {
  const navigate = useNavigate();
  const item = (ativo: boolean) => ativo
    ? { background: OURO, color: "#1A1200" }
    : { background: "transparent", color: "#d8d2c4" };
  return (
    <nav aria-label="Áreas de produtos" className="grid grid-cols-4 gap-1 rounded-[14px] p-1" style={{ background: "#121211", border: "1px solid #24221e" }}>
      <button type="button" aria-pressed={aba === "produtos"} onClick={() => onAba("produtos")} className="h-9 rounded-[11px] text-[13.5px] font-bold" style={item(aba === "produtos")}>Produtos</button>
      <button type="button" aria-pressed={aba === "estoque"} onClick={() => onAba("estoque")} className="h-9 rounded-[11px] text-[13.5px] font-bold" style={item(aba === "estoque")}>
        Estoque{alerta && <span aria-label="tem estoque baixo" style={{ color: aba === "estoque" ? "#1A1200" : OURO }}> •</span>}
      </button>
      <button type="button" onClick={() => navigate("/products/produzir")} className="h-9 rounded-[11px] text-[13.5px] font-bold" style={item(false)}>Produção</button>
      <button type="button" onClick={() => navigate("/products/mercado")} className="h-9 rounded-[11px] text-[13.5px] font-bold" style={item(false)}>Mercado</button>
    </nav>
  );
}

export function RegistrarCompra() {
  const navigate = useNavigate();
  // the main action of the screen: solid VANT yellow, dark text (24/11 mockup)
  return (
    <button type="button" onClick={() => navigate("/products/mercado")} className="w-full min-h-[58px] rounded-[16px] px-4 py-2.5 flex items-center gap-3 text-left active:scale-[.99] transition-transform"
      style={{ background: OURO, color: "#1A1200", boxShadow: "0 8px 24px rgba(245,184,0,.18)" }}>
      <ShoppingCart className="w-6 h-6 shrink-0 mx-1" strokeWidth={2.4} />
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-[16.5px] font-extrabold leading-tight">Registrar compra</span>
        <span className="text-[12px] font-semibold leading-snug" style={{ color: "#3d3000" }}>Os ingredientes entram no estoque.</span>
      </span>
      <ChevronRight className="w-6 h-6 shrink-0" strokeWidth={2.6} />
    </button>
  );
}
