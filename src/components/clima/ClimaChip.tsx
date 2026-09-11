/* ============================================================
   CLIMA CHIP — a entrada do clima no topo do Dashboard (Rick, 11/09).
   Cabeça do Orbis + temperatura + o aviso que importa. Toque abre /clima.
   Usa só o tempo (sem IA) — barato, cache de 30 min no aparelho.
   ============================================================ */
import { useNavigate } from "react-router-dom";
import { useClima } from "@/hooks/useClima";

const BASE = "/orbis/clima";

export function ClimaChip() {
  const navigate = useNavigate();
  const { tempo, erro } = useClima({ comOpiniao: false });
  if (!tempo) {
    if (erro) return null; // sem posição/erro: o chip some, não atrapalha a Home
    return <span className="w-[112px] h-10 rounded-full animate-pulse shrink-0" style={{ background: "#131211", border: "1px solid rgba(255,255,255,.08)" }} aria-hidden />;
  }
  const e = tempo.estado;
  const boneco = e === "frio" ? "frio" : e === "chuva" || e === "tempestade" ? "chuva" : e === "noite" ? "noite" : "calor";
  const cor = e === "tempestade" ? "#FF5C5C" : e === "chuva" ? "#5b8def" : e === "frio" ? "#4FD8F5" : e === "calor" ? "#ff9d4d" : e === "noite" ? "#a78bfa" : "#3DD68C";
  const rotulo = e === "sol" ? "sol" : e === "calor" ? "calor" : e === "nublado" ? "nublado" : e === "chuva" ? "chuva" : e === "tempestade" ? "raios" /* "tempestade" não cabe ao lado da saudação */ : e === "frio" ? "frio" : "noite";
  // curto de propósito: o chip divide a linha com a saudação, a chama e o avatar
  const aviso = tempo.alerta
    ? (e === "tempestade" ? "fica em casa" : "alerta")
    : tempo.chuva && tempo.chuva.proxima != null && e !== "chuva" && e !== "tempestade"
    ? `chuva ${tempo.chuva.proxima}h`
    : e === "chuva" ? "chovendo"
    : e === "calor" ? "gelada vende"
    : e === "frio" ? "café vende"
    : e === "noite" ? "noite boa"
    : "dia de ralar";
  return (
    <button
      type="button"
      onClick={() => navigate("/clima")}
      aria-label={`Clima: ${Math.round(tempo.temp)} graus, ${rotulo}. ${aviso}`}
      className="orbis-press inline-flex items-center gap-[7px] h-[38px] pl-[3px] pr-[11px] rounded-full shrink-0 whitespace-nowrap"
      style={{ border: `1px solid ${cor}66`, background: `linear-gradient(90deg, ${cor}1f, #131211)` }}
    >
      <span className="relative w-8 h-8 rounded-full overflow-hidden shrink-0" style={{ background: "#0d0c0b" }}>
        {/* maxWidth: none — o reset do Tailwind põe max-width:100% em <img> e encolheria a cabeça pra 32px */}
        <img src={`${BASE}/${boneco}-boneco.webp`} alt="" className="absolute" style={{ left: -24, top: -7, width: 64, maxWidth: "none", height: "auto" }} draggable={false} />
      </span>
      <span className="flex flex-col gap-[2px] leading-none text-left">
        <span className="orbis-num text-[12.5px] font-extrabold">{Math.round(tempo.temp)}° <span className="font-semibold" style={{ color: "#b9b3a6" }}>{rotulo}</span></span>
        <span className="text-[10px] font-extrabold tracking-[.02em]" style={{ color: cor }}>{aviso}</span>
      </span>
    </button>
  );
}
