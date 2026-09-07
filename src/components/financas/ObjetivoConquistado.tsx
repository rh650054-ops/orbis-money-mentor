/* Comemoração: um objetivo (meta) encheu. Confete + card dourado + compartilhar. */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Trophy, Share2 } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";

export function ObjetivoConquistado({ nome, valor, dias, onFechar, onNovo }: {
  nome: string; valor: number; dias: number; onFechar: () => void; onNovo: () => void;
}) {
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const confetti = (await import("canvas-confetti")).default;
        if (!vivo) return;
        const cores = ["#F5B800", "#FFC63A", "#3DD68C", "#ffffff"];
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: cores, zIndex: 100 });
        setTimeout(() => vivo && confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 }, colors: cores, zIndex: 100 }), 250);
        setTimeout(() => vivo && confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 }, colors: cores, zIndex: 100 }), 400);
      } catch { /* sem confete, sem drama */ }
    })();
    return () => { vivo = false; };
  }, []);

  const compartilhar = async () => {
    const texto = `Objetivo conquistado no Orbis: ${nome} — ${formatCurrency(valor)} guardados em ${dias} dias de trabalho. Quem vende na rua e se organiza, sobe. app.orbis.inf.br`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Objetivo conquistado", text: texto });
        return;
      }
      await navigator.clipboard.writeText(texto);
      toast({ title: "Texto copiado", description: "Cola no seu story do Instagram." });
    } catch { /* cancelou */ }
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-5" role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.88)" }} onClick={onFechar} />
      <div
        className="orbis-victory relative w-full max-w-sm rounded-[22px] border px-5 py-6 text-center"
        style={{ "--win-color": "rgba(245,184,0,.55)", background: "linear-gradient(160deg,#1C1608 0%,#111 60%)", borderColor: "rgba(245,184,0,.45)", boxShadow: "0 24px 70px -24px rgba(245,184,0,.55)" } as React.CSSProperties}
      >
        <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(180deg,#FFC63A,#F5B800)", boxShadow: "0 4px 0 #B88700" }}>
          <Trophy size={28} strokeWidth={3} color="#1A1200" />
        </div>
        <p className="mt-4 text-[10.5px] font-extrabold uppercase tracking-[.18em]" style={{ color: "#F5B800" }}>Objetivo conquistado</p>
        <h2 className="text-[26px] font-black tracking-tight leading-[1.2] mt-1.5 text-foreground">
          {nome}<br /><span style={{ color: "#F5B800" }}>{formatCurrency(valor)} guardados</span>
        </h2>
        <p className="text-[13px] mt-2.5 leading-[1.5]" style={{ color: "#B9B3A6" }}>
          {dias > 0 ? <>Foram <b className="text-foreground">{dias} dia{dias === 1 ? "" : "s"}</b> separando um pedaço do lucro. </> : null}
          Isso é disciplina de quem sobe no ranking.
        </p>
        <button type="button" onClick={compartilhar} className="orbis-cta w-full mt-5 flex items-center justify-center gap-2" style={{ height: 52 }}>
          <Share2 className="w-4 h-4" strokeWidth={3} /> COMPARTILHAR
        </button>
        <button type="button" onClick={onNovo} className="w-full mt-2 h-10 text-[13px] font-bold" style={{ color: "#B9B3A6" }}>
          criar o próximo objetivo
        </button>
      </div>
    </div>,
    document.body,
  );
}
