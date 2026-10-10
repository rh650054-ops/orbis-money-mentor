/* Primeira vez em Produtos: explica o porquê e chama o quiz. */
import { ChevronLeft } from "lucide-react";
import { OURO } from "./quiz-casca";

const PASSOS = ["Nome do produto", "Quanto você paga", "Quanto você cobra", "Quantos você tem"];

export function IntroProdutos({ onComecar, onVoltar }: { onComecar: () => void; onVoltar: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black">
      <div className="min-h-[100dvh] bg-black text-[#F4F1EA] px-4 max-w-md mx-auto flex flex-col gap-3 relative overflow-hidden"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 18px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onVoltar} aria-label="Voltar" className="-ml-1 p-1" style={{ color: "#7b766e" }}><ChevronLeft className="w-6 h-6" /></button>
        <span className="text-xl font-black">Produtos</span>
      </div>
      <div className="absolute -left-16 -right-16 top-10 h-[300px] pointer-events-none" style={{ background: "radial-gradient(55% 55% at 50% 40%, rgba(245,184,0,.14), rgba(0,0,0,0) 70%)" }} />
      <div className="relative pt-4 flex flex-col gap-2">
        <span className="text-[10.5px] font-black tracking-[.16em]" style={{ color: "#F5B800" }}>PRODUTOS &amp; ESTOQUE</span>
        <h1 className="text-[27px] font-black tracking-tight leading-[1.08]">Descubra quanto sobra em cada venda</h1>
        <p className="text-[13.5px] leading-snug" style={{ color: "#b9b3a6" }}>Cadastre o que você vende uma vez. A VANT calcula seu lucro e desconta do estoque a cada venda no Foco.</p>
      </div>
      <div className="relative rounded-[20px] p-4 flex flex-col gap-3 mt-1.5" style={{ background: "#0f0f10", border: "1px solid #26241f" }}>
        <span className="text-[10px] font-black tracking-[.14em]" style={{ color: "#7b766e" }}>EXEMPLO</span>
        <div className="flex items-center gap-3">
          <span className="w-[46px] h-[46px] rounded-xl flex items-center justify-center text-[22px]" style={{ background: "linear-gradient(160deg, #3a2a0a, #161005)" }}>🍬</span>
          <span className="flex flex-col"><span className="text-[15px] font-black">Mentos</span><span className="text-xs font-bold" style={{ color: "#7b766e" }}>estoque: 32 rolos</span></span>
        </div>
        <div className="flex gap-2">
          {([["VOCÊ PAGA", "R$ 1,40", false], ["VOCÊ COBRA", "R$ 3,00", false], ["SOBRA", "R$ 1,60", true]] as const).map(([r, v, verde]) => (
            <div key={r} className="flex-1 rounded-xl p-2.5 flex flex-col gap-0.5"
              style={verde ? { background: "rgba(61,214,140,.1)", border: "1px solid rgba(61,214,140,.35)" } : { background: "#151514" }}>
              <span className="text-[10.5px] font-extrabold" style={{ color: verde ? "#3DD68C" : "#7b766e" }}>{r}</span>
              <span className="text-[17px] font-black" style={{ color: verde ? "#3DD68C" : undefined }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <ol className="relative flex flex-col gap-2.5 px-0.5 pt-1">
        {PASSOS.map((t, i) => (
          <li key={t} className="flex gap-3 items-center text-[13.5px] font-bold">
            <span className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs font-black" style={{ background: "#1a1305", color: "#F5B800" }}>{i + 1}</span>
            {t}{i === 3 && <span className="font-semibold" style={{ color: "#7b766e" }}>· pode pular</span>}
          </li>
        ))}
      </ol>
      <div className="flex-grow" />
      <button type="button" onClick={onComecar} className="relative w-full h-[54px] rounded-2xl text-[15px] font-black" style={{ background: OURO, color: "#1A1200" }}>
        CADASTRAR MEU PRIMEIRO PRODUTO
      </button>
      <span className="text-center text-xs font-bold" style={{ color: "#7b766e" }}>Leva menos de 1 minuto</span>
    </div>
    </div>
  );
}
