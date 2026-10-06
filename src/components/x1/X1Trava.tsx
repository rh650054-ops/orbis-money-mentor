/* ============================================================
   TRAVA DO X1 — só luta quem tem banco ligado (4B do mockup Open Finance,
   fluxo aprovado em 03/10/2026). O placar da luta é o Pix que cai no banco;
   sem banco, não dá pra saber quem vendeu de verdade.
   • useTravaBanco: lê orbis_pro_status uma vez e diz se o vendedor tem banco.
   • TravaX1: o cartão com cadeado; "LIGAR MEU BANCO" leva pra aba Vender
     (que decide entre convite → paywall ou widget do banco).
   Quem não tem banco ainda vê lutas e salas ao vivo (vitrine), mas não
   desafia, não abre sala, não encara e não aceita desafio.
   ============================================================ */
import { useNavigate } from "react-router-dom";
import { Lock, Landmark } from "lucide-react";

const GOLD = "#F5B800";

export function TravaX1({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  return (
    <div className={`rounded-[20px] border p-4 text-center grid justify-items-center gap-2 ${className}`}
      style={{ background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)", borderColor: "rgba(245,184,0,.42)" }}>
      <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(245,184,0,.12)", border: "1px solid rgba(245,184,0,.45)" }}>
        <Lock className="w-6 h-6" style={{ color: GOLD }} strokeWidth={2.4} />
      </span>
      <p className="text-[16px] font-black leading-tight text-balance">O X1 é só entre vendedores conferidos</p>
      <p className="text-[11.5px] leading-relaxed" style={{ color: "#b9b3a6" }}>
        O placar da luta é o Pix que cai no banco. Sem banco ligado, não tem como saber quem vendeu de verdade.
      </p>
      <button type="button" onClick={() => navigate("/verificar")} className="x1-btn ouro mt-1" style={{ height: 50, fontSize: 13.5 }}>
        <Landmark className="w-4 h-4" strokeWidth={2.6} /> LIGAR MEU BANCO
      </button>
      <span className="text-[10.5px] font-bold" style={{ color: "#7b766e" }}>Banco ligado · a partir de R$ 12,90/mês no Essencial</span>
    </div>
  );
}
