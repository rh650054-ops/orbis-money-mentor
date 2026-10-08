/* ============================================================
   CLIMA CHIP — a entrada do clima no Dashboard (redesenho 08/10/2026).
   Antes: a cabeça do boneco ocupava espaço demais. Agora: ícone de 20px
   (nuvem/sol/chuva/raio, com bolinha de alerta) + temperatura + a decisão
   em 1–2 palavras. Usa só o tempo (sem IA) — barato, cache de 30 min.
   ============================================================ */
import { useNavigate } from "react-router-dom";
import { CloudOff } from "lucide-react";
import { useClima } from "@/hooks/useClima";
import { decisaoAgora, riscoSevero } from "./decisao";
import { iconeDo } from "./tela/icone-tempo";

const COR = { bom: "#3DD68C", atencao: "#F5B800", risco: "#FF6B5E", neutro: "#b3ada3" } as const;

/** A decisão em 1–2 palavras, pra caber ao lado da saudação. */
function curta(titulo: string): string {
  if (titulo.startsWith("Pausa")) return "pausa a venda";
  if (titulo.startsWith("Espera até")) return titulo.replace("Espera até ", "abre ");
  if (titulo.startsWith("Janela curta até")) return titulo.replace("Janela curta até ", "seco até ");
  if (titulo.startsWith("Dá pra vender")) return "dá pra vender";
  if (titulo.startsWith("Hora de descansar")) return "descansa";
  if (titulo.startsWith("Hoje o clima aperta")) return "dia difícil";
  return "ver clima";
}

export function ClimaChip() {
  const navigate = useNavigate();
  const { tempo, erro } = useClima({ comOpiniao: false });
  const base = "orbis-press inline-flex items-center gap-2 h-[38px] px-3 rounded-full shrink-0 whitespace-nowrap transition-transform duration-100 active:scale-[0.97]";

  if (!tempo) {
    // BUG-003 (29/09): sem posição ou com falha, o chip continua levando pra /clima
    if (erro) {
      const sem = erro === "sem_posicao";
      return (
        <button type="button" onClick={() => navigate("/clima")} aria-label={sem ? "Clima: ative a localização" : "Clima indisponível, toque para tentar de novo"}
          className={base} style={{ border: "1px solid rgba(255,255,255,.14)", background: "#131211" }}>
          <CloudOff className="w-5 h-5" strokeWidth={2} style={{ color: "#b3ada3" }} />
          <span className="text-[12px] font-extrabold" style={{ color: "#F5B800" }}>{sem ? "ativar" : "tentar"}</span>
        </button>
      );
    }
    return <span className="w-[104px] h-[38px] rounded-full animate-pulse shrink-0" style={{ background: "#131211", border: "1px solid rgba(255,255,255,.08)" }} aria-hidden />;
  }

  const { Icone, cor: corIcone } = iconeDo(tempo.codigo, tempo.ehDia);
  const d = decisaoAgora(tempo);
  const alerta = !!riscoSevero(tempo) || (tempo.oficiais ?? []).length > 0;
  const cor = COR[d.nivel];
  const aviso = curta(d.titulo);
  return (
    <button type="button" onClick={() => navigate("/clima")} aria-label={`Clima: ${Math.round(tempo.temp)} graus, ${tempo.condicao}. ${aviso}`}
      className={base} style={{ border: `1px solid ${cor}55`, background: "#131211" }}>
      <span className="relative">
        <Icone className="w-5 h-5" strokeWidth={2} style={{ color: corIcone }} />
        {alerta && <i className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full border-2" style={{ background: "#FF6B5E", borderColor: "#131211" }} />}
      </span>
      <span className="text-[13px] font-extrabold tabular-nums">{Math.round(tempo.temp)}°</span>
      <span className="text-[12px] font-bold" style={{ color: cor }}>{aviso}</span>
    </button>
  );
}
