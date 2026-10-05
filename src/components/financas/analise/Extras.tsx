/* 6 · RAIO-X (a única entrada), 7 · FERRAMENTAS e 8 · MAIS OPÇÕES (import em PDF, rebaixado). */
import { useState } from "react";
import { Calculator, ChevronDown, ChevronRight, ScanSearch, Upload } from "lucide-react";
import { BotaoPrimario, COR, Cartao, Rotulo } from "../planejar/ui";

export function RaioXCard({ onAbrir }: { onAbrir: () => void }) {
  return (
    <Cartao style={{ borderColor: "rgba(245,184,0,.22)" }}>
      <div className="flex gap-3">
        <span className="w-9 h-9 shrink-0 rounded-[11px] flex items-center justify-center" style={{ background: "rgba(245,184,0,.12)" }} aria-hidden>
          <ScanSearch className="w-5 h-5" strokeWidth={2} style={{ color: COR.ouro }} />
        </span>
        <div className="min-w-0">
          <Rotulo cor={COR.ouro}>Raio-X</Rotulo>
          <p className="text-[18px] font-bold leading-snug mt-1" style={{ color: COR.texto }}>Investigue seu extrato</p>
          <p className="text-[13.5px] mt-1 leading-snug" style={{ color: COR.sub }}>Veja cada movimentação, categoria e banco em um só lugar.</p>
        </div>
      </div>
      <BotaoPrimario onClick={onAbrir} className="mt-4 h-12">Abrir Raio-X</BotaoPrimario>
    </Cartao>
  );
}

export function Ferramentas({ onCusto }: { onCusto: () => void }) {
  return (
    <section aria-label="Ferramentas">
      <h2 className="text-[16px] font-black uppercase tracking-[.08em] mb-2" style={{ color: COR.texto }}>Ferramentas</h2>
      <Cartao className="p-0">
        <button type="button" onClick={onCusto}
          className="group w-full text-left p-4 flex gap-3 items-start rounded-[18px] transition-[transform,background-color] duration-[120ms] active:scale-[0.99] active:bg-white/[.05]">
          <span className="w-9 h-9 shrink-0 rounded-[11px] flex items-center justify-center" style={{ background: "#1A1A1A" }} aria-hidden>
            <Calculator className="w-5 h-5" strokeWidth={2} style={{ color: "#d8d3c9" }} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[16px] font-bold" style={{ color: COR.texto }}>Custo por produto</span>
            <span className="block text-[13px] mt-0.5 leading-snug" style={{ color: COR.sub }}>Fotografe suas compras e descubra quanto custa cada unidade.</span>
            <span className="inline-flex items-center gap-0.5 mt-2 text-[14px] font-extrabold" style={{ color: COR.ouro }}>
              Calcular custo <ChevronRight className="w-4 h-4 transition-transform duration-[120ms] group-active:translate-x-0.5" strokeWidth={2.6} />
            </span>
          </span>
        </button>
      </Cartao>
    </section>
  );
}

export function MaisOpcoes({ onImportar }: { onImportar: () => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}
        className="min-h-11 inline-flex items-center gap-1 text-[14px] font-bold rounded-[10px] -ml-1 px-1 transition-colors duration-100 active:bg-white/[.05]" style={{ color: COR.sub }}>
        Mais opções <ChevronDown className="w-4 h-4 transition-transform duration-200" style={{ transform: aberto ? "rotate(180deg)" : "none" }} strokeWidth={2.4} />
      </button>
      {aberto && (
        <button type="button" onClick={onImportar}
          className="orbis-card-in w-full min-h-12 flex items-center gap-3 text-left text-[14px] font-semibold rounded-[12px] px-1 transition-colors duration-100 active:bg-white/[.05]" style={{ color: COR.texto }}>
          <Upload className="w-5 h-5 shrink-0" strokeWidth={2} style={{ color: COR.sub }} />
          <span className="flex-1">Importar histórico de vendas (PDF)</span>
          <ChevronRight className="w-4 h-4" style={{ color: "#5c5850" }} />
        </button>
      )}
    </div>
  );
}
