/* Oferta do dia no fim do Foco (Rick, 06/10/2026). Uma vez por dia, sempre depois
   de uma conquista: dia 1 o VANT Essencial, dia 2 a prévia do VANT Pro, dia 3 os planos.
   No dia 0 não aparece nada: o primeiro dia é só valor, sem preço. */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getCheckoutUrl } from "@/shared/lib/checkout";
import { useJornada } from "./useJornada";
import { jornadaDoDia, brl, seloTeste } from "./jornada-lib";

const GOLD = "#F5B800";
const MUTE = "#7b766e";
const AZUL = "#4FB3FF";

function Item({ texto, sub }: { texto: string; sub: string }) {
  return (
    <li className="flex items-center gap-3 py-2.5" style={{ borderTop: "1px solid #1c1b18" }}>
      <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(61,214,140,.14)", color: "#3DD68C" }}>
        <Check className="w-3 h-3" strokeWidth={3.5} />
      </span>
      <span className="text-[13.5px] font-extrabold">{texto} <span className="font-semibold" style={{ color: MUTE }}>· {sub}</span></span>
    </li>
  );
}

/** `agora`: abre na hora, mesmo se já foi vista hoje (usado pelo simulador). */
export function OfertaDoDia({ agora = false }: { agora?: boolean } = {}) {
  const { user } = useAuth();
  const { emTeste, dia, vendidoNoTeste } = useJornada();
  const navigate = useNavigate();
  const [aberta, setAberta] = useState(agora);
  const j = jornadaDoDia(dia);
  const chave = user?.id && j ? `vant_oferta_${user.id}_${j.dia}` : null;

  useEffect(() => {
    if (agora || !emTeste || !j || j.oferta === "nenhuma" || !chave) return;
    let jaViu = false;
    try { jaViu = localStorage.getItem(chave) === "1"; } catch { /* sem storage: mostra */ }
    if (jaViu) return;
    const t = setTimeout(() => {
      setAberta(true);
      try { localStorage.setItem(chave, "1"); } catch { /* ok */ }
    }, 1200);
    return () => clearTimeout(t);
  }, [agora, emTeste, j, chave]);

  if (!aberta || !j || j.oferta === "nenhuma") return null;
  const fechar = () => setAberta(false);

  return (
    <div role="dialog" aria-modal="true" aria-label="Oferta do dia" className="fixed inset-0 z-[80] flex items-end justify-center" style={{ background: "rgba(0,0,0,.62)" }}>
      <div className="w-full max-w-[480px] rounded-t-[26px] px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3.5"
        style={{ background: "#0b0b0c", borderTop: `1px solid ${j.oferta === "pro" ? "rgba(79,179,255,.4)" : "rgba(245,184,0,.35)"}`, boxShadow: "0 -24px 60px rgba(0,0,0,.8)" }}>
        <div className="w-[38px] h-1 rounded mx-auto" style={{ background: "#2a2824" }} />

        {j.oferta === "essencial" && (
          <>
            <div className="space-y-1.5">
              <p className="text-[11px] font-black tracking-[.18em]" style={{ color: GOLD }}>VANT ESSENCIAL</p>
              <p className="text-[24px] font-black tracking-[-.02em] leading-[1.1]">Isso que você usou hoje é seu por R$ 29,90/mês</p>
              <p className="text-[13px]" style={{ color: "#b9b3a6" }}>Menos de R$ 1 por dia. Menos que uma venda.</p>
            </div>
            <ul className="rounded-[16px] px-3.5" style={{ background: "#111112", border: "1px solid #23211d" }}>
              <Item texto="Foco (DEFCON)" sub="meta e conversão todo dia" />
              <Item texto="Ranking" sub="sua liga e sua posição" />
              <Item texto="Relatório" sub="quanto sobrou de verdade" />
              <Item texto="Comunidade" sub="vendedores do Brasil todo" />
            </ul>
            <button type="button" onClick={fechar} className="w-full h-[52px] rounded-[16px] text-[14.5px] font-black"
              style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
              CONTINUAR MEU TESTE · {seloTeste(j.dia).replace("Teste grátis · ", "").toUpperCase()}
            </button>
            <a href={getCheckoutUrl()} target="_blank" rel="noopener noreferrer" className="block text-center text-[12.5px] font-extrabold underline underline-offset-[3px]" style={{ color: "#b9b3a6" }}>
              já quero garantir o Essencial por R$ 29,90
            </a>
          </>
        )}

        {j.oferta === "pro" && (
          <>
            <div className="space-y-1.5">
              <p className="text-[11px] font-black tracking-[.18em]" style={{ color: AZUL }}>PRÉVIA DO VANT PRO</p>
              <p className="text-[24px] font-black tracking-[-.02em] leading-[1.1]">O Pix entra sozinho e o lucro aparece sem fazer conta</p>
            </div>
            <ul className="rounded-[16px] px-3.5" style={{ background: "#111112", border: "1px solid #23211d" }}>
              <Item texto="Pix contado pelo banco" sub="sem digitar nada" />
              <Item texto="Financeiro completo" sub="lucro, contas e caixinhas" />
              <Item texto="Caça-Sinal" sub="os melhores pontos perto de você" />
              <Item texto="Selo azul no ranking" sub="seu número conferido" />
            </ul>
            <p className="flex items-center gap-2 text-[11.5px] font-bold" style={{ color: MUTE }}>
              <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: AZUL }} /> Você liga o banco quando assinar o VANT Pro.
            </p>
            <button type="button" onClick={() => { fechar(); navigate("/planos"); }} className="w-full h-[52px] rounded-[16px] text-[14.5px] font-black"
              style={{ background: "linear-gradient(180deg,#4FB3FF 0%,#0095F6 100%)", color: "#fff" }}>
              CONHECER O VANT PRO
            </button>
            <button type="button" onClick={fechar} className="w-full text-[12.5px] font-extrabold underline underline-offset-[3px]" style={{ color: "#b9b3a6" }}>
              continuar testando
            </button>
          </>
        )}

        {j.oferta === "planos" && (
          <>
            <div className="space-y-1.5">
              <p className="text-[11px] font-black tracking-[.18em]" style={{ color: "#ff9a4d" }}>ÚLTIMO DIA DO TESTE</p>
              <p className="text-[24px] font-black tracking-[-.02em] leading-[1.1]">
                {vendidoNoTeste && vendidoNoTeste > 0 ? `Você vendeu ${brl(vendidoNoTeste)} com a VANT` : "Seu teste acaba hoje às 23:59"}
              </p>
              <p className="text-[13px]" style={{ color: "#b9b3a6" }}>Sem plano, amanhã o Foco, o histórico e o seu lugar no ranking travam.</p>
            </div>
            <button type="button" onClick={() => { fechar(); navigate("/planos"); }} className="w-full h-[52px] rounded-[16px] text-[14.5px] font-black"
              style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
              ESCOLHER MEU PLANO
            </button>
            <button type="button" onClick={fechar} className="w-full text-[12.5px] font-extrabold underline underline-offset-[3px]" style={{ color: "#b9b3a6" }}>
              vender hoje e decidir à noite
            </button>
          </>
        )}
      </div>
    </div>
  );
}
