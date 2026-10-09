/* ============================================================
   CENA DA VANT (08/10/2026) — a volta da "cena do clima" do Orbis, agora com
   o mascote 3D da VANT (Rick: "lembra como o mascote ficava na versão
   anterior do orbis? isso que eu quero fazer agr com a vant").
   Igual à de antes: o mascote GRANDE no meio de uma cena que ocupa meia tela,
   respirando, pulando quando toca, reagindo ao tempo (treme no frio, se abana
   no calor, se encolhe na tempestade) e o tempo acontecendo em volta dele
   (sol com raios, nuvens passando, chuva em duas camadas, relâmpago, vento,
   estrelas). A temperatura fica por cima, no canto de baixo.
   ============================================================ */
import type { ReactNode } from "react";
import type { Estado } from "@/components/clima/ClimaTipos";
import { CenaFundo } from "./CenaFundo";
import { FxAtras, FxFrente } from "./CenaFx";
import { MASCOTE_SRC } from "./VantPersonagem";
import { useMovimentoMascote } from "./use-movimento-mascote";

const PROPORCAO = "596 / 1378";
/* boca do mascote no recorte (pro hálito do frio) */
const BOCA = { left: "50%", top: "25%" };

export function CenaVant({ estado, toques, onToque, children }: { estado: Estado; toques: number; onToque: () => void; children?: ReactNode }) {
  const { refFora, refDentro } = useMovimentoMascote(estado, toques);
  const chove = estado === "chuva" || estado === "tempestade";
  return (
    <div className="cl-cena relative" style={{ borderRadius: 0, boxShadow: "none" }} onClick={onToque} role="button" aria-label="Toque no mascote da VANT">
      <div className="cl-mundo">
        <CenaFundo estado={estado} />
        <FxAtras estado={estado} />

        {/* reflexo no chão molhado */}
        {chove && (
          <img src={MASCOTE_SRC} alt="" aria-hidden draggable={false} className="absolute pointer-events-none"
            style={{ left: "63%", top: "95%", height: "70%", aspectRatio: PROPORCAO, transform: "translateX(-50%) scaleY(-1)", opacity: 0.18, filter: "blur(2px)", maskImage: "linear-gradient(180deg,#000,transparent 35%)", WebkitMaskImage: "linear-gradient(180deg,#000,transparent 35%)" }} />
        )}
        {/* sombra no chão */}
        <span className="absolute rounded-[50%] blur-md pointer-events-none" style={{ left: "63%", bottom: "4.5%", width: "44%", height: "5%", transform: "translateX(-50%)", background: "rgba(0,0,0,.55)" }} />

        <div className="absolute pointer-events-none" style={{ left: "63%", bottom: "5%", height: "90%", aspectRatio: PROPORCAO, transform: "translateX(-50%)" }}>
          <div ref={refFora} className="w-full h-full" style={{ transformOrigin: "50% 92%", willChange: "transform" }}>
            <div ref={refDentro} className="relative w-full h-full" style={{ transformOrigin: "50% 90%", willChange: "transform" }}>
              <img src={MASCOTE_SRC} alt="Mascote da VANT" draggable={false} className="block w-full h-full select-none" />
              {estado === "frio" && <><span className="cl-halito" style={BOCA} /><span className="cl-halito b" style={BOCA} /></>}
            </div>
          </div>
        </div>

        <FxFrente estado={estado} />
      </div>
      <span className="cl-fx cl-escuro" />
      {children}
    </div>
  );
}
