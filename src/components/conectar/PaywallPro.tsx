/* ============================================================
   PAYWALL DO VANT PRO (v3 aprovada pelo Rick, 02/10/2026).
   Anual já vem marcado, com o preço mensal equivalente (R$ 29,99) ao lado
   dos R$ 49,90 do mensal. Embaixo, a tabela: o que os dois planos têm e o
   que só o Pro destrava, cada benefício com nome e uma linha.
   O botão abre o checkout da Hotmart da oferta escolhida.
   ============================================================ */
import { useState } from "react";
import { SeloVerificado } from "@/components/ranking/AvatarRanking";
import { getProCheckoutUrl, type PlanoPro } from "@/shared/lib/checkout";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const MUTE = "#7b766e";
const LINHA = "rgba(255,255,255,.07)";

const OS_DOIS = ["DEFCON e metas", "Ranking"];
const SO_PRO: { nome: string; linha: string }[] = [
  { nome: "Selo Verificado", linha: "seu número com prova do banco" },
  { nome: "Raio-X Total", linha: "todo o seu dinheiro lido direto do banco" },
  { nome: "Piloto Automático", linha: "cada gasto entra sozinho, já organizado" },
  { nome: "Estoque Vivo", linha: "a IA avisa o que vai acabar e o que mais gira" },
  { nome: "Arena Pro", linha: "X1 e Sala com prêmios toda semana e todo mês" },
  { nome: "Caça-Sinal Turbo", linha: "os melhores pontos antes dos outros" },
  { nome: "Blindagem Fiscal", linha: "MEI, DAS e imposto sem susto" },
];

function Plano({ ativo, onClick, titulo, sub, preco, extra, destaque }: {
  ativo: boolean; onClick: () => void; titulo: string; sub: string; preco: string; extra?: string; destaque?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className="relative w-full rounded-2xl p-3 text-left flex items-center justify-between gap-3 active:opacity-80"
      style={{
        background: ativo ? "linear-gradient(170deg,#1a1305,#0e0e10 70%)" : "#0f0f10",
        border: `1px solid ${ativo ? GOLD : "#26241f"}`,
        boxShadow: ativo ? "0 0 0 1px rgba(245,184,0,.25)" : "none",
      }}>
      {destaque && (
        <span className="absolute -top-2.5 right-3 rounded-full px-2 py-[3px] text-[9px] font-black tracking-[.1em]"
          style={{ background: GOLD, color: "#1a1305" }}>MAIS ESCOLHIDO</span>
      )}
      <span className="flex items-center gap-2.5 min-w-0">
        <span className="w-[18px] h-[18px] rounded-full shrink-0" style={{
          border: `2px solid ${ativo ? GOLD : "#3a3833"}`,
          background: ativo ? `radial-gradient(circle,${GOLD} 45%,transparent 50%)` : "transparent",
        }} />
        <span className="min-w-0">
          <span className="block text-[14px] font-black">{titulo}</span>
          <span className="block text-[10.5px] font-bold" style={{ color: MUTE }}>{sub}</span>
        </span>
      </span>
      <span className="text-right shrink-0">
        <span className="block text-[17px] font-black tabular-nums" style={{ color: ativo ? GOLD : "#F4F1EA" }}>
          {preco}<span className="text-[11px]" style={{ color: MUTE }}>/mês</span>
        </span>
        {extra && <span className="block text-[10.5px] font-bold" style={{ color: OK }}>{extra}</span>}
      </span>
    </button>
  );
}

export function PaywallPro() {
  const [plano, setPlano] = useState<PlanoPro>("anual");

  return (
    <div className="space-y-2.5">
      <div className="text-center pt-1 pb-1">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-[.14em]" style={{ color: GOLD }}>
          SELO VERIFICADO <SeloVerificado size={16} />
        </p>
        <h1 className="text-[23px] font-black tracking-[-.02em] leading-[1.1] mt-2 text-balance">
          Vende na rua. A Vant cuida do resto.
        </h1>
      </div>

      <div className="space-y-3 pt-1">
        <Plano destaque ativo={plano === "anual"} onClick={() => setPlano("anual")}
          titulo="Anual" sub="R$ 359,90 por ano" preco="R$ 29,99" extra="economiza R$ 238" />
        <Plano ativo={plano === "mensal"} onClick={() => setPlano("mensal")}
          titulo="Mensal" sub="cancela quando quiser" preco="R$ 49,90" />
      </div>

      <div className="rounded-[18px] px-3 py-3" style={{ background: "#0f0f10", border: `1px solid ${LINHA}` }}>
        <div className="grid grid-cols-[1fr_44px_44px] items-center text-[9.5px] font-black tracking-[.1em] pb-1.5" style={{ color: MUTE }}>
          <span>OS DOIS TÊM</span><span className="text-center">BÁSICO</span><span className="text-center" style={{ color: GOLD }}>PRO</span>
        </div>
        {OS_DOIS.map((n) => (
          <div key={n} className="grid grid-cols-[1fr_44px_44px] items-center py-2" style={{ borderTop: `1px solid ${LINHA}` }}>
            <span className="text-[12.5px] font-extrabold">{n}</span>
            <span className="text-center font-black" style={{ color: OK }}>✓</span>
            <span className="text-center font-black" style={{ color: OK }}>✓</span>
          </div>
        ))}
        <p className="text-[10px] font-black tracking-[.15em] pt-2.5 pb-1" style={{ color: GOLD }}>SÓ NO PRO</p>
        {SO_PRO.map((b) => (
          <div key={b.nome} className="grid grid-cols-[1fr_44px_44px] items-center py-2" style={{ borderTop: `1px solid ${LINHA}` }}>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-extrabold">{b.nome}</span>
              <span className="block text-[10px] leading-snug" style={{ color: MUTE }}>{b.linha}</span>
            </span>
            <span className="text-center" style={{ color: "#3a3833" }}>—</span>
            <span className="text-center font-black" style={{ color: OK }}>✓</span>
          </div>
        ))}
      </div>

      <a href={getProCheckoutUrl(plano)}
        className="w-full h-[54px] rounded-[14px] inline-flex items-center justify-center text-[15px] font-black tracking-[.02em] active:translate-y-[1px]"
        style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200", boxShadow: "0 10px 24px -12px rgba(255,200,0,.8)" }}>
        {plano === "anual" ? "ASSINAR · R$ 359,90/ANO" : "ASSINAR · R$ 49,90/MÊS"}
      </a>
      <p className="text-[10.5px] font-bold text-center" style={{ color: MUTE }}>
        Pagamento pela Hotmart · 7 dias de garantia · a senha do banco nunca passa pela Vant
      </p>
    </div>
  );
}
