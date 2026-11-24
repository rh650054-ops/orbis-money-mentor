/* Produtos e Estoque (24/11/2026): the panel pieces around the list. Summary numbers, the area
   navigation (Produtos / Estoque are tabs here; Produção and Mercado open their existing screens) and the
   "Registrar compra" action at the end of the list (no longer a floating button over the content). */
import { useNavigate } from "react-router-dom";
import { Box, ChevronRight, Factory, Layers, ShoppingCart } from "lucide-react";

const OURO = "#F5B800";

export function ResumoPainel({ produtos, unidades, podeProduzir, calculando }: { produtos: number; unidades: number; podeProduzir: number; calculando: boolean }) {
  // icon on top, number, then the label on its own line: three cards fit side by side down to 360 px
  const Card = ({ Icone, rotulo, valor, sufixo, cor }: { Icone: typeof Box; rotulo: string; valor: string; sufixo?: string; cor?: string }) => (
    <div className="rounded-[18px] p-3 flex flex-col gap-2 min-w-0" style={{ background: "#151515", border: "1px solid #2a2722" }}>
      <span className="w-9 h-9 rounded-[12px] flex items-center justify-center" style={{ background: `${cor ?? OURO}1f` }}>
        <Icone className="w-5 h-5" style={{ color: cor ?? OURO }} strokeWidth={2.2} />
      </span>
      <span className="flex flex-wrap items-baseline gap-x-1 leading-none">
        <span className="text-[28px] font-black tabular-nums tracking-tight" style={{ color: cor ?? "#F4F1EA" }}>{valor}</span>
        {sufixo && <span className="text-[12.5px] font-extrabold" style={{ color: cor ?? "#F4F1EA" }}>{sufixo}</span>}
      </span>
      <span className="text-[12px] font-bold leading-snug" style={{ color: "#c9c3b5" }}>{rotulo}</span>
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
    <nav aria-label="Áreas de produtos" className="grid grid-cols-4 gap-1 rounded-[16px] p-1" style={{ background: "#121211", border: "1px solid #24221e" }}>
      <button type="button" aria-pressed={aba === "produtos"} onClick={() => onAba("produtos")} className="h-11 rounded-[12px] text-[14px] font-black" style={item(aba === "produtos")}>Produtos</button>
      <button type="button" aria-pressed={aba === "estoque"} onClick={() => onAba("estoque")} className="h-11 rounded-[12px] text-[14px] font-black" style={item(aba === "estoque")}>
        Estoque{alerta && <span aria-label="tem estoque baixo" style={{ color: aba === "estoque" ? "#1A1200" : OURO }}> •</span>}
      </button>
      <button type="button" onClick={() => navigate("/products/produzir")} className="h-11 rounded-[12px] text-[14px] font-black" style={item(false)}>Produção</button>
      <button type="button" onClick={() => navigate("/products/mercado")} className="h-11 rounded-[12px] text-[14px] font-black" style={item(false)}>Mercado</button>
    </nav>
  );
}

export function RegistrarCompra() {
  const navigate = useNavigate();
  // the main action of the screen: solid VANT yellow, dark text (24/11 mockup)
  return (
    <button type="button" onClick={() => navigate("/products/mercado")} className="w-full min-h-[68px] rounded-[18px] px-4 py-3 flex items-center gap-3 text-left active:scale-[.99] transition-transform"
      style={{ background: OURO, color: "#1A1200", boxShadow: "0 8px 24px rgba(245,184,0,.18)" }}>
      <span className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0" style={{ background: "rgba(26,18,0,.12)" }}><ShoppingCart className="w-6 h-6" strokeWidth={2.4} /></span>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-[17px] font-black leading-tight">Registrar compra</span>
        <span className="text-[12.5px] font-bold leading-snug" style={{ color: "#4a3a00" }}>Os ingredientes entram no estoque.</span>
      </span>
      <ChevronRight className="w-6 h-6 shrink-0" strokeWidth={2.6} />
    </button>
  );
}
