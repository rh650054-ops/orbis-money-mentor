/* ============================================================
   CLIMA CHIP — a entrada do clima no Dashboard e no Foco.
   21/10/2026 (Mohamed): virou um selo compacto — temperatura em cima,
   ícone do tempo embaixo com animação leve. O texto da decisão
   ("descansa", "dá pra vender") saiu do chip e continua na tela /clima.
   A cor da borda ainda mostra a decisão (verde / amarelo / vermelho).
   ============================================================ */
import { useNavigate } from "react-router-dom";
import { CloudOff } from "lucide-react";
import { useClima } from "@/hooks/useClima";
import { decisaoAgora, riscoSevero } from "./decisao";
import { iconeDo } from "./tela/icone-tempo";

const COR = { bom: "#3DD68C", atencao: "#F5B800", risco: "#FF6B5E", neutro: "#b3ada3" } as const;
const BASE = "orbis-press inline-flex flex-col items-center justify-center w-[42px] h-[42px] rounded-[14px] shrink-0 leading-none transition-transform duration-100 active:scale-[0.95]";

export function ClimaChip() {
  const navigate = useNavigate();
  const { tempo, erro } = useClima({ comOpiniao: false });

  if (!tempo) {
    // BUG-003 (29/09): sem posição ou com falha, o chip continua levando pra /clima
    if (erro) {
      const sem = erro === "sem_posicao";
      return (
        <button type="button" onClick={() => navigate("/clima")} aria-label={sem ? "Clima: ative a localização" : "Clima indisponível, toque para tentar de novo"}
          className={BASE} style={{ border: "1px solid rgba(255,255,255,.14)", background: "#131211" }}>
          <span className="text-[9.5px] font-extrabold" style={{ color: "#F5B800" }}>{sem ? "ativar" : "tentar"}</span>
          <CloudOff className="w-4 h-4 mt-[3px]" strokeWidth={2} style={{ color: "#b3ada3" }} />
        </button>
      );
    }
    return <span className="w-[42px] h-[42px] rounded-[14px] animate-pulse shrink-0" style={{ background: "#131211", border: "1px solid rgba(255,255,255,.08)" }} aria-hidden />;
  }

  const { Icone, cor: corIcone } = iconeDo(tempo.codigo, tempo.ehDia);
  const d = decisaoAgora(tempo);
  const alerta = !!riscoSevero(tempo) || (tempo.oficiais ?? []).length > 0;
  const graus = Math.round(tempo.temp);
  return (
    <button type="button" onClick={() => navigate("/clima")} aria-label={`Clima: ${graus} graus, ${tempo.condicao}. ${d.titulo}`}
      className={`${BASE} relative`} style={{ border: `1px solid ${COR[d.nivel]}55`, background: "#131211" }}>
      <span className="text-[11.5px] font-extrabold tabular-nums">{graus}°</span>
      <span className="orbis-clima-drift mt-[3px]">
        <Icone className="w-[17px] h-[17px]" strokeWidth={2} style={{ color: corIcone }} />
      </span>
      {alerta && <i className="absolute top-1 right-1 w-2 h-2 rounded-full border-2" style={{ background: "#FF6B5E", borderColor: "#131211" }} />}
    </button>
  );
}
