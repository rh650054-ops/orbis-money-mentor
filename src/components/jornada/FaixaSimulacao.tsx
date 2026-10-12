/* Faixa fina no topo enquanto o admin está simulando um dia do teste — e sempre na conta de teste. */
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSimulacao } from "./simulador";
import { useContaTeste } from "./conta-teste";

export function FaixaSimulacao() {
  const { user } = useAuth();
  const dia = useSimulacao(user?.id);
  const navigate = useNavigate();
  const contaTeste = useContaTeste(user?.id);
  if (dia == null && !contaTeste) return null;
  return (
    <button type="button" onClick={() => navigate("/simular-teste")}
      className="fixed top-0 inset-x-0 z-[200] h-6 text-[10.5px] font-black tracking-[.12em]"
      style={{ background: "#7c3aed", color: "#fff" }}>
      {dia == null
        ? "CONTA DE TESTE · DIA 0 DE VERDADE · TOCAR PRA ESCOLHER O DIA"
        : <>SIMULAÇÃO · {dia === 4 ? "TESTE ACABOU" : `DIA ${dia} DO TESTE`} · TOCAR PRA TROCAR</>}
    </button>
  );
}
