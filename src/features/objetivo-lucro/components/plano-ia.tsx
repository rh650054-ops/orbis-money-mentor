/* The Vant's plan of attack: numbered steps from the AI and the biggest risk. */
import { TriangleAlert } from "lucide-react";
import type { PlanoIa } from "../types";
import { COR } from "./ui";

export function PlanoIaCard({ ia }: { ia: PlanoIa | null }) {
  if (!ia || ia.passos.length === 0) return null;
  return (
    <section className="vant-hud mt-3 rounded-[22px] p-4 pt-5 overflow-hidden" style={{ border: "1px solid rgba(245,184,0,.3)" }}>
      <span className="vant-canto" />
      <p className="orbis-section inline-flex items-center gap-2" style={{ color: COR.ouro }}><span className="w-4 h-px" style={{ background: COR.ouro }} /> Plano de ataque</p>
      <ol className="mt-3 flex flex-col">
        {ia.passos.map((s, i) => (
          <li key={i} className="flex gap-3 relative pb-4 last:pb-0">
            {i < ia.passos.length - 1 && <span className="absolute left-[15px] top-8 bottom-0 w-px" style={{ background: "rgba(245,184,0,.25)" }} />}
            <span className="vant-missao-num w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[15px] pt-0.5" style={{ background: "#0b0b0d", color: COR.ouro, border: `1.5px solid ${COR.ouro}`, boxShadow: `0 0 12px ${COR.ouro}44` }}>{String(i + 1).padStart(2, "0")}</span>
            <span className="min-w-0 pt-1">
              <span className="block text-[14.5px] font-black leading-tight" style={{ color: COR.texto }}>{s.titulo}</span>
              <span className="block text-[12.5px] mt-1 leading-snug" style={{ color: COR.sub }}>{s.texto}</span>
            </span>
          </li>
        ))}
      </ol>
      {ia.alerta && (
        <p className="mt-4 rounded-[12px] px-3 py-2.5 text-[12.5px] leading-snug flex gap-2" style={{ background: "rgba(229,115,127,.1)", border: "1px solid rgba(229,115,127,.35)", color: COR.texto }}>
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: COR.vermelho }} /> <span><b style={{ color: COR.vermelho }}>Risco: </b>{ia.alerta}</span>
        </p>
      )}
    </section>
  );
}
