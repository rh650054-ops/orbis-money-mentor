/* Faixa fina no topo enquanto o admin está simulando um dia do teste. */
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSimulacao } from "./simulador";

export function FaixaSimulacao() {
  const { user } = useAuth();
  const dia = useSimulacao(user?.id);
  const navigate = useNavigate();
  if (dia == null) return null;
  return (
    <button type="button" onClick={() => navigate("/simular-teste")}
      className="fixed top-0 inset-x-0 z-[200] h-6 text-[10.5px] font-black tracking-[.12em]"
      style={{ background: "#7c3aed", color: "#fff" }}>
      SIMULAÇÃO · {dia === 4 ? "TESTE ACABOU" : `DIA ${dia} DO TESTE`} · TOCAR PRA TROCAR
    </button>
  );
}
