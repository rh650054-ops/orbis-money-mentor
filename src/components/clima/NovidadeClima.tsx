/* ============================================================
   NOVIDADE: CLIMA DO VENDEDOR — card de lançamento na Home (Rick, 11/09).
   Aparece uma vez por pessoa (guardado no aparelho) com o avatar novo do
   Orbis. Toque no botão abre /clima; "depois" esconde e não volta.
   ============================================================ */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Sparkles } from "lucide-react";

const BASE = "/orbis/clima";
const chave = (userId: string) => `orbis_novidade_clima_v1_${userId}`;

export function NovidadeClima({ userId }: { userId: string }) {
  const [visivel, setVisivel] = useState(() => { try { return localStorage.getItem(chave(userId)) !== "1"; } catch { return true; } });
  const navigate = useNavigate();
  if (!visivel) return null;
  const fechar = () => { try { localStorage.setItem(chave(userId), "1"); } catch { /* ignore */ } setVisivel(false); };
  return (
    <section
      className="orbis-card-in relative overflow-hidden rounded-[22px] border"
      style={{ borderColor: "rgba(245,184,0,.45)", background: "linear-gradient(160deg,#1c1608 0%,#131211 55%, #0f1622 100%)", boxShadow: "0 24px 50px -30px rgba(245,184,0,.5)" }}
    >
      {/* o avatar novo, saindo da borda direita */}
      <img src={`${BASE}/calor-boneco.webp`} alt="" draggable={false} className="absolute pointer-events-none" style={{ right: -34, top: -6, width: 176, height: "auto", filter: "drop-shadow(0 12px 24px rgba(0,0,0,.6))" }} />
      <span className="absolute pointer-events-none" style={{ right: 10, top: 10, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,214,110,.35), rgba(255,214,110,0) 70%)" }} />
      <button type="button" onClick={fechar} aria-label="Fechar" className="absolute left-3 top-3 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.12)", color: "#b9b3a6" }}>
        <X className="w-3.5 h-3.5" strokeWidth={2.6} />
      </button>

      <div className="relative pt-12 pb-4 px-4 pr-[150px] flex flex-col gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[.16em] uppercase" style={{ color: "#F5B800" }}>
          <Sparkles className="w-3.5 h-3.5" strokeWidth={2.4} /> Novo no Orbis
        </span>
        <p className="text-[20px] font-black leading-[1.12] tracking-tight">O Orbis agora olha o céu por você.</p>
        <p className="text-[13px] leading-[1.45]" style={{ color: "#b9b3a6" }}>
          Ele junta <b className="text-foreground">6 previsões</b>, olha suas contas e sua melhor hora, e te diz: <b className="text-foreground">dia de ralar, de descansar ou de ficar em casa</b> — e a hora certa de sair.
        </p>
      </div>
      <div className="relative px-4 pb-4 flex items-center gap-3">
        <button type="button" onClick={() => { fechar(); navigate("/clima"); }} className="orbis-cta flex-1" style={{ height: 50, fontSize: 14 }}>
          VER O CLIMA DE HOJE
        </button>
        <button type="button" onClick={fechar} className="h-[50px] px-3 text-[13px] font-bold shrink-0" style={{ color: "#7e7869" }}>depois</button>
      </div>
    </section>
  );
}
