/* Selo pequeno do teste no topo das telas ("Teste grátis · faltam 2 dias").
   Substitui a faixa grande que ficava em todas as telas sem poder fechar. */
import { useNavigate } from "react-router-dom";
import { useJornada } from "./useJornada";
import { seloTeste } from "./jornada-lib";

export function SeloTeste() {
  const { emTeste, dia } = useJornada();
  const navigate = useNavigate();
  if (!emTeste || dia == null) return null;
  const ultimo = dia >= 3;
  return (
    <div className="mb-3 flex justify-center">
      <button type="button" onClick={() => navigate("/planos")}
        className="rounded-full px-3 py-1.5 text-[11px] font-extrabold"
        style={ultimo
          ? { background: "rgba(255,122,26,.12)", border: "1px solid rgba(255,122,26,.5)", color: "#ff9a4d" }
          : { background: "#121211", border: "1px solid #26241f", color: "#b9b3a6" }}>
        {seloTeste(dia)}
      </button>
    </div>
  );
}
