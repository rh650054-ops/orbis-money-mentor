/* ============================================================
   NOVIDADE: CLIMA DO VENDEDOR — abertura em tela cheia (Rick, 11/09).
   Toma a frente da tela quando a pessoa abre o app, com o fundo
   escurecido e desfocado atrás. Aparece UMA vez por pessoa
   (guardado no aparelho). Botão abre /clima; "agora não" fecha
   pra sempre. Tocar no fundo também fecha.
   ============================================================ */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { X, Sparkles, CloudSun } from "lucide-react";
import "@/styles/clima.css";

const BASE = "/orbis/clima";
const chave = (userId: string) => `orbis_novidade_clima_v1_${userId}`;

export function NovidadeClima({ userId }: { userId: string }) {
  const [visivel, setVisivel] = useState(() => { try { return localStorage.getItem(chave(userId)) !== "1"; } catch { return true; } });
  const navigate = useNavigate();

  // trava a rolagem da Home enquanto a novidade está na frente
  useEffect(() => {
    if (!visivel) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = antes; };
  }, [visivel]);

  if (!visivel) return null;
  const fechar = () => { try { localStorage.setItem(chave(userId), "1"); } catch { /* ignore */ } setVisivel(false); };

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-center justify-center px-5 py-6" role="dialog" aria-modal="true" aria-label="Novidade: clima do vendedor">
      {/* fundo: escurece e desfoca a Home atrás */}
      <button
        type="button" aria-label="Fechar" onClick={fechar}
        className="absolute inset-0 cl-nov-fundo"
        style={{ background: "rgba(6,6,5,.78)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
      />

      <section
        className="cl-nov-card relative w-full max-w-[360px] max-h-full overflow-hidden rounded-[26px] border flex flex-col"
        style={{ borderColor: "rgba(245,184,0,.45)", background: "linear-gradient(170deg,#1d1708 0%,#141312 46%,#0f1622 100%)", boxShadow: "0 40px 90px -30px rgba(245,184,0,.45), 0 0 0 1px rgba(0,0,0,.6)" }}
      >
        {/* palco do mascote */}
        {/* overflow-hidden: a foto é inteira (cabeça aos pés), aqui só cabe até o peito */}
        <div className="relative w-full shrink-0 overflow-hidden" style={{ height: 246 }}>
          <span className="absolute pointer-events-none" style={{ left: "50%", top: 4, width: 250, height: 250, marginLeft: -125, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,208,92,.34), rgba(255,208,92,0) 68%)" }} />
          <img
            src={`${BASE}/calor-boneco.webp?v=2`} alt="O Orbis" draggable={false}
            className="cl-nov-boneco absolute left-1/2 top-0"
            style={{ width: 268, maxWidth: "none", height: "auto", marginLeft: -134, filter: "drop-shadow(0 18px 30px rgba(0,0,0,.65))" }}
          />
          {/* a foto some pra dentro do card */}
          <span className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: 92, background: "linear-gradient(180deg, rgba(20,19,18,0) 0%, rgba(20,19,18,.85) 55%, #141312 100%)" }} />
          <button
            type="button" onClick={fechar} aria-label="Fechar"
            className="orbis-press absolute right-3 top-3 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.16)", color: "#d6d0c4" }}
          >
            <X className="w-4 h-4" strokeWidth={2.6} />
          </button>
        </div>

        {/* texto + botões */}
        <div className="relative px-5 pb-5 -mt-3 flex flex-col gap-2.5 overflow-y-auto" style={{ background: "linear-gradient(180deg,#141312 0%,#141312 55%,#0f1622 100%)" }}>
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[.16em] uppercase" style={{ color: "#F5B800" }}>
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2.4} /> Novo no Orbis
          </span>
          <p className="font-display text-[23px] font-black leading-[1.14] tracking-tight">
            O Orbis agora olha<br />o céu por você.
          </p>
          <p className="text-[13.5px] leading-[1.5]" style={{ color: "#b9b3a6" }}>
            Ele junta <b className="text-foreground">6 previsões</b>, olha suas contas e sua melhor hora, e te diz: <b className="text-foreground">dia de ralar, de descansar ou de ficar em casa</b> — e a hora certa de sair.
          </p>
          <button
            type="button" onClick={() => { fechar(); navigate("/clima"); }}
            className="orbis-cta w-full mt-1.5 flex items-center justify-center gap-2"
            style={{ height: 52, fontSize: 14.5 }}
          >
            <CloudSun className="w-[18px] h-[18px]" strokeWidth={2.6} /> VER O CLIMA DE HOJE
          </button>
          <button type="button" onClick={fechar} className="w-full h-9 text-[13px] font-bold" style={{ color: "#7e7869" }}>
            agora não
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
