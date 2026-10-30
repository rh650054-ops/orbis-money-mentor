/* X1 em grupo dentro do Foco (Rick, 30/10): quando o dia tem 2+ rivais (vários X1 e/ou
   uma sala), a faixa vira um placar com TODO MUNDO — posição, foto, nome, quanto fez —,
   o líder em dourado, você destacado e "subindo" em quem ganhou posição agora. Toca → arena. */
import { useNavigate } from "react-router-dom";
import { Crown, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import type { X1Lutador } from "@/hooks/useX1DefconAlert";
import { X1Avatar } from "@/components/x1/X1Avatar";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const primeiro = (n: string) => (n || "").trim().split(/\s+/)[0] || "Vendedor";

export function DefconX1Grupo({ grupo }: { grupo: X1Lutador[] }) {
  const navigate = useNavigate();
  const eu = grupo.find((g) => g.eu);
  const lider = grupo[0];
  const acima = eu ? grupo.filter((g) => g.total > eu.total).at(-1) : undefined;
  const segundo = grupo.find((g) => !g.eu && g.total < (eu?.total ?? 0));
  const status = !eu || !lider ? "" : eu.pos === 1 && eu.total > (grupo.find((g) => !g.eu)?.total ?? 0)
    ? `Você lidera · +${formatCurrency(eu.total - (segundo?.total ?? 0))} na frente`
    : acima ? `${primeiro(acima.nome)} tá ${formatCurrency(acima.total - eu.total)} na sua frente` : "Tá tudo empatado — a próxima venda decide";
  const linhas = grupo.length > 5 ? [...grupo.slice(0, 4), ...(eu && eu.pos > 4 ? [eu] : grupo.slice(4, 5))] : grupo;

  return (
    <button type="button" onClick={() => navigate("/x1")} aria-label="Abrir arena do X1"
      className="mx-auto w-[min(340px,92vw)] rounded-[18px] border px-3 pt-2 pb-2.5 text-left active:scale-[.98] transition-transform"
      style={{ background: "radial-gradient(120% 90% at 50% 0%, #1a1306, #0b0b0d 70%)", borderColor: "rgba(245,184,0,.35)", boxShadow: "0 0 16px rgba(245,184,0,.14)" }}>
      <p className="flex items-center justify-between text-[9.5px] font-black tracking-[.2em]" style={{ color: "#8a8378" }}>
        <span className="flex items-center gap-1.5"><i className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#F2465A" }} /> X1 AO VIVO · {grupo.length} NA BRIGA</span>
        <span>HOJE</span>
      </p>
      <ol className="mt-1.5 space-y-1">
        {linhas.map((g) => {
          const lidera = g.pos === 1 && g.total > 0;
          return (
            <li key={g.id} className="flex items-center gap-2 h-8 rounded-[10px] px-1.5 transition-all"
              style={g.eu ? { background: "rgba(245,184,0,.1)", boxShadow: "inset 0 0 0 1px rgba(245,184,0,.45)" } : g.subindo ? { background: "rgba(61,214,140,.08)" } : undefined}>
              <span className="w-4 text-center text-[12px] font-black tabular-nums" style={{ color: lidera ? GOLD : "#8a8378" }}>{g.pos}</span>
              <span className="relative">
                <X1Avatar url={g.avatar} nome={g.nome} size={24} cor={lidera ? GOLD : g.eu ? GOLD : "#3a3833"} />
                {lidera && <Crown className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3" style={{ color: GOLD }} fill={GOLD} strokeWidth={1} />}
              </span>
              <span className="flex-1 min-w-0 truncate text-[12.5px] font-black" style={{ color: g.eu ? "#fff" : "#e9e4d8" }}>{g.eu ? "Você" : primeiro(g.nome)}</span>
              {g.subindo && (
                <span className="shrink-0 inline-flex items-center gap-0.5 text-[9.5px] font-black px-1.5 py-0.5 rounded-full" style={{ color: OK, background: "rgba(61,214,140,.14)" }}>
                  <TrendingUp className="w-3 h-3" /> subindo
                </span>
              )}
              <span className="shrink-0 text-[12.5px] font-black tabular-nums" style={{ color: lidera ? GOLD : "#e9e4d8" }}>{formatCurrency(g.total)}</span>
            </li>
          );
        })}
      </ol>
      {status && <p className="mt-1.5 text-center text-[11px] font-bold" style={{ color: eu?.pos === 1 ? OK : "#ff9aa6" }}>{status}</p>}
    </button>
  );
}
