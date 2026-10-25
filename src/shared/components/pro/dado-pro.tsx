/* DADO DO PRO (Rick, 25/10/2026): o dado aparece FOSCO pra quem não tem o Pro, com um
   selo "Só no VANT Pro" por cima. Ele vê que a informação existe e é dele, mas só lê
   com o Pro. O conteúdo borrado não é clicável nem lido por leitor de tela. */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";

const GOLD = "#F5B800";

export function DadoPro({ children, travado, chamada = "Só no VANT Pro", acao = "Ver o Pro", compacto = false }: {
  children: ReactNode; travado: boolean; chamada?: string; acao?: string; compacto?: boolean;
}) {
  if (!travado) return <>{children}</>;
  return <Fosco chamada={chamada} acao={acao} compacto={compacto}>{children}</Fosco>;
}

function Fosco({ children, chamada, acao, compacto }: { children: ReactNode; chamada: string; acao: string; compacto: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="relative">
      <div aria-hidden className="select-none pointer-events-none" style={{ filter: "blur(4.5px)", opacity: 0.9 }}>{children}</div>
      <button type="button" onClick={() => navigate("/pro")}
        className="absolute inset-0 flex items-center justify-center"
        aria-label={`${chamada}. ${acao}`}>
        <span className={`inline-flex items-center gap-1.5 rounded-full font-black ${compacto ? "px-2.5 py-1 text-[10.5px]" : "px-3.5 py-2 text-[12px]"}`}
          style={{ background: "rgba(11,11,11,.88)", border: `1px solid ${GOLD}66`, color: GOLD, boxShadow: "0 10px 26px -12px rgba(0,0,0,.9)" }}>
          <Lock className={compacto ? "w-3 h-3" : "w-3.5 h-3.5"} strokeWidth={2.8} /> {chamada}
          {!compacto && <span className="font-extrabold" style={{ color: "#F4F1EA" }}>· {acao}</span>}
        </span>
      </button>
    </div>
  );
}
