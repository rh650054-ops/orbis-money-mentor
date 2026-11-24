/* Produtos e Estoque (24/11/2026): the panel pieces around the list. Summary numbers, the area
   navigation (Produtos / Estoque are tabs here; Produção and Mercado open their existing screens) and the
   "Registrar compra" action at the end of the list (no longer a floating button over the content). */
import { useNavigate } from "react-router-dom";
import { ChevronRight, ShoppingCart } from "lucide-react";

const OURO = "#F5B800";

export function ResumoPainel({ produtos, unidades, podeProduzir, calculando }: { produtos: number; unidades: number; podeProduzir: number; calculando: boolean }) {
  const Card = ({ rotulo, valor, sub }: { rotulo: string; valor: string; sub: string }) => (
    <div className="rounded-[18px] px-3 py-3 flex flex-col gap-1 min-w-0" style={{ background: "#151515", border: "1px solid #24221e" }}>
      <span className="text-[10px] font-extrabold tracking-[.1em] uppercase leading-tight" style={{ color: "#8a857b" }}>{rotulo}</span>
      <span className="text-[24px] font-black tabular-nums leading-none">{valor}</span>
      <span className="text-[10.5px] font-bold leading-tight" style={{ color: "#6f6a61" }}>{sub}</span>
    </div>
  );
  return (
    <div className="grid grid-cols-3 gap-2">
      <Card rotulo="Produtos" valor={String(produtos)} sub="cadastrados" />
      <Card rotulo="Em estoque" valor={unidades.toLocaleString("pt-BR")} sub="unidades prontas" />
      <Card rotulo="Pode produzir" valor={calculando ? "…" : String(podeProduzir)} sub={podeProduzir === 1 ? "produto hoje" : "produtos hoje"} />
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
      <button type="button" aria-pressed={aba === "produtos"} onClick={() => onAba("produtos")} className="h-10 rounded-[12px] text-[13px] font-black" style={item(aba === "produtos")}>Produtos</button>
      <button type="button" aria-pressed={aba === "estoque"} onClick={() => onAba("estoque")} className="h-10 rounded-[12px] text-[13px] font-black" style={item(aba === "estoque")}>
        Estoque{alerta && <span aria-label="tem estoque baixo" style={{ color: aba === "estoque" ? "#1A1200" : OURO }}> •</span>}
      </button>
      <button type="button" onClick={() => navigate("/products/produzir")} className="h-10 rounded-[12px] text-[13px] font-black" style={item(false)}>Produção</button>
      <button type="button" onClick={() => navigate("/products/mercado")} className="h-10 rounded-[12px] text-[13px] font-black" style={item(false)}>Mercado</button>
    </nav>
  );
}

export function RegistrarCompra() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/products/mercado")} className="w-full rounded-[20px] p-4 flex items-center gap-3 text-left"
      style={{ border: "1px solid transparent", background: "linear-gradient(#171206,#0f0d08) padding-box, linear-gradient(135deg,#FFE27A,#B88E00 60%,#FFC800) border-box" }}>
      <span className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.14)" }}><ShoppingCart className="w-5 h-5" style={{ color: OURO }} /></span>
      <span className="flex-1 flex flex-col"><span className="text-[15px] font-black">Registrar compra</span><span className="text-[12px] font-bold" style={{ color: "#8a857b" }}>Os ingredientes entram no estoque.</span></span>
      <ChevronRight className="w-5 h-5" style={{ color: OURO }} />
    </button>
  );
}
