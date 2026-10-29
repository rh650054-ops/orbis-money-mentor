/* "QUAL É A SUA META?" (Rick, 29/10/2026): "Editar planejamento" first asks what kind of
   goal — the month in revenue (the form as it always was) or profit in the pocket (the
   mission flow, Pro). Pure: the parent decides what each choice opens. */
import { Lock, TrendingUp, Wallet } from "lucide-react";

const OURO = "#F5B800";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function EscolhaTipoMeta({ onFaturamento, onLucro, proTravado = false, onPro }: {
  onFaturamento: () => void; onLucro: () => void;
  /** Essencial: "Lucro no bolso" shows a lock and opens the Pro page */
  proTravado?: boolean; onPro?: () => void;
}) {
  const mes = MESES[new Date().getMonth()] ?? "";
  return (
    <div className="space-y-2.5" aria-label="Tipo de meta">
      <p className="text-[13px]" style={{ color: "var(--orbis-fg-2)" }}>Qual é a sua meta de {mes}? A VANT monta o seu dia em cima dela.</p>
      <button type="button" onClick={proTravado ? (onPro ?? onLucro) : onLucro}
        className="w-full text-left rounded-[18px] p-4 flex gap-3 active:scale-[0.98] transition-transform"
        style={{ background: "linear-gradient(170deg,rgba(245,184,0,.10),#131211 65%)", border: "1px solid rgba(245,184,0,.4)" }}>
        <span className="w-11 h-11 rounded-[13px] shrink-0 flex items-center justify-center" style={{ background: "rgba(245,184,0,.14)" }}>
          {proTravado ? <Lock className="w-5 h-5" style={{ color: OURO }} /> : <Wallet className="w-5 h-5" style={{ color: OURO }} strokeWidth={2.2} />}
        </span>
        <span className="min-w-0">
          <span className="inline-flex items-center gap-2 text-[15.5px] font-extrabold" style={{ color: OURO }}>
            Lucro no bolso <span className="text-[9px] font-black tracking-[.12em] px-1.5 py-0.5 rounded-full" style={{ background: OURO, color: "#1a1305" }}>PRO</span>
          </span>
          <span className="block text-[12.5px] mt-1 leading-snug" style={{ color: "var(--orbis-fg-2)" }}>
            "Quero R$ 3.000 limpos em 15 dias." A VANT desconta custo, calote e o corre do dia e diz quantas batidas vender por dia.
          </span>
          <span className="block text-[11px] font-bold mt-1.5" style={{ color: OURO }}>{proTravado ? "Ver o VANT Pro" : "Recomendado: é o que sobra que paga as contas."}</span>
        </span>
      </button>
      <button type="button" onClick={onFaturamento}
        className="w-full text-left rounded-[18px] p-4 flex gap-3 active:scale-[0.98] transition-transform"
        style={{ background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.1)" }}>
        <span className="w-11 h-11 rounded-[13px] shrink-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,.05)" }}>
          <TrendingUp className="w-5 h-5" style={{ color: "var(--orbis-fg-2)" }} strokeWidth={2.2} />
        </span>
        <span className="min-w-0">
          <span className="block text-[15.5px] font-extrabold text-foreground">Faturamento do mês</span>
          <span className="block text-[12.5px] mt-1 leading-snug" style={{ color: "var(--orbis-fg-2)" }}>
            "Quero vender R$ 9.000." Meta de venda, horas e dias de trabalho, como sempre.
          </span>
        </span>
      </button>
    </div>
  );
}
