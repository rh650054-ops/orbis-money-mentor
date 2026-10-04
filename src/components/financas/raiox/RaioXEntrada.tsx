/* Entrada do Raio-X nas Finanças (aba Análise).
   04/10/2026 (Mohamed): o Raio-X lê SÓ o que vem dos bancos ligados (Open
   Finance / Piloto Automático) — não pede mais extrato em PDF. Quem não tem
   banco ligado vê o convite pra ligar. */
import { useNavigate } from "react-router-dom";
import { useRaioXMeses } from "@/hooks/useRaioXExtrato";
import { mesAtualIso, mesNome } from "./raiox-utils";
import { ConviteBanco } from "../FinancasAbas";

export default function RaioXEntrada({ userId, temBanco }: { userId: string | undefined; temBanco: boolean }) {
  const navigate = useNavigate();
  const { meses } = useRaioXMeses(userId);
  const atual = mesAtualIso();
  const doMes = meses.find((m) => m.mes === atual);
  const bancos = (doMes?.bancos ?? []).filter((b) => b && b !== "?");

  if (!temBanco) {
    return <ConviteBanco onLigar={() => navigate("/verificar")} texto="O Raio-X lê seus gastos direto do banco e mostra pra onde o dinheiro está indo." />;
  }

  return (
    <section className="orbis-card-in rounded-[18px] border p-4 flex flex-col gap-2" style={{ background: "linear-gradient(160deg,#171307,#0d0d0c)", borderColor: "rgba(255,200,0,.35)" }}>
      <p className="text-[10px] font-black tracking-[.16em]" style={{ color: "#F5B800" }}>RAIO-X FINANCEIRO</p>
      <p className="text-[15px] font-extrabold text-foreground">Veja pra onde seu dinheiro está indo.</p>
      {bancos.length > 0 && (
        <p className="text-[12.5px] font-semibold" style={{ color: "#b9b3a6" }}>{bancos.join(" · ")} · {mesNome(atual)}</p>
      )}
      <button
        type="button"
        onClick={() => navigate(`/financas/extrato?mes=${doMes ? atual : (meses[0]?.mes ?? atual)}`)}
        className="mt-1 w-full h-11 rounded-xl text-[14px] font-black active:scale-[0.98] transition-transform"
        style={{ background: "linear-gradient(180deg,#ffc63a,#F5B800)", color: "#1a1200", boxShadow: "0 4px 0 #b88700" }}
      >
        Abrir Raio-X
      </button>
    </section>
  );
}
