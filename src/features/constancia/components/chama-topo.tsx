/* The flame chip at the top of the Home (Rick, 05/11): the streak, not the days of the month.
   Lit as soon as he opens the Foco today; ice when frozen or lost; a small lock during the rescue.
   Tap opens the Constância panel. No animation here — the big one plays at the end of the day. */
import { useState } from "react";
import { Lock } from "lucide-react";
import { useConstanciaQuery } from "../api/use-constancia";
import { ChamaIcone, lookDoEstado } from "./chama-icone";
import { ConstanciaPainel } from "./constancia-painel";

export function ChamaTopo({ userId }: { userId: string | undefined }) {
  const { data: c } = useConstanciaQuery(userId);
  const [aberto, setAberto] = useState(false);
  const dias = c?.dias ?? 0;
  const estado = c?.estado ?? "nunca";
  const look = lookDoEstado(estado, dias);
  const numero = estado === "resgate" ? c!.guardados + c!.resgate : dias;
  const cor = look === "gelo" ? "#9FD6F5" : look === "apagada" ? "#57534A" : undefined;
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} aria-label={`Chama da constância: ${numero} dias${estado === "congelada" ? ", congelada" : estado === "perdeu" ? ", perdida" : estado === "resgate" ? ", em resgate" : ""}. Toque para ver`}
        className="inline-flex items-center gap-1 shrink-0 px-1.5 py-1 rounded-full active:scale-95 transition-transform">
        <ChamaIcone size={16} look={look} />
        <b className="orbis-num" style={{
          fontSize: 13.5, fontWeight: 800, lineHeight: 1,
          ...(cor ? { color: cor } : { background: "linear-gradient(180deg,#FFE59A,#F9CE63 48%,#EFB23A)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }),
        }}>{numero}</b>
        {estado === "resgate" && <Lock className="w-3 h-3" style={{ color: "#F9CE63" }} aria-hidden />}
      </button>
      <ConstanciaPainel userId={userId} open={aberto} onOpenChange={setAberto} />
    </>
  );
}
