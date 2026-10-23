/* /assinar — opened from the STORE app in the phone browser (Néctar model, Rick 23/10/2026).
   The token in the URL says who is subscribing, so no login here: pick a plan, one
   button, straight to Hotmart with name/e-mail/phone prefilled. Also works without a
   token (plain visitor): same plans, Hotmart asks the data itself. */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { aoClicarCheckout, comIdentidade, getCheckoutUrl, getProCheckoutUrl } from "@/shared/lib/checkout";
import { useQuemAssinaQuery } from "../api/use-assinar-token";

const GOLD = "#F5B800";
const MUTE = "#7b766e";
type Plano = "mensal" | "anual" | "essencial";

const PLANOS: { id: Plano; nome: string; preco: string; por: string; sub: string; selo?: string; cta: string }[] = [
  { id: "mensal", nome: "VANT Pro Mensal", preco: "R$ 49,90", por: "/mês", sub: "1 banco · selo azul · financeiro · IA · Caça-Sinal", cta: "Assinar por R$ 49,90/mês" },
  { id: "anual", nome: "VANT Pro Anual", preco: "R$ 418,80", por: "/ano", sub: "R$ 34,90/mês · 2 bancos · economiza R$ 180", selo: "MAIS ESCOLHIDO", cta: "Assinar por R$ 418,80/ano" },
  { id: "essencial", nome: "VANT Essencial", preco: "R$ 29,90", por: "/mês", sub: "Foco · ranking · relatório · comunidade · sem banco", cta: "Assinar por R$ 29,90/mês" },
];

export default function AssinarPage() {
  const [params] = useSearchParams();
  const token = params.get("t");
  const quem = useQuemAssinaQuery(token);
  const [plano, setPlano] = useState<Plano>("mensal");
  const p = quem.data ?? null;
  // Essencial subscriber: this is an upgrade, hide the Essencial card
  const lista = PLANOS.filter((x) => !(p?.plano_atual === "essencial" && x.id === "essencial"));
  const escolhido = lista.find((x) => x.id === plano) ?? lista[0]!;
  const base = escolhido.id === "essencial" ? getCheckoutUrl() : getProCheckoutUrl(escolhido.id);
  const href = p ? comIdentidade(base, { email: p.email, nome: p.nome, telefone: p.telefone, userId: p.user_id }) : base;

  return (
    <div className="min-h-screen px-5 pt-10 pb-12 max-w-md mx-auto text-[#F4F1EA]" style={{ background: "radial-gradient(80% 50% at 50% 0%, #1a1305, #000 70%)" }}>
      <p className="text-center font-mono text-[11px] font-bold tracking-[.3em]" style={{ color: GOLD }}>VANT</p>
      <h1 className="text-center text-[30px] font-black tracking-[-.02em] mt-1">{p?.plano_atual === "essencial" ? "Suba pro VANT Pro" : "Assine a VANT"}</h1>

      <p className="font-mono text-[10.5px] font-bold tracking-[.2em] mt-8 mb-2.5" style={{ color: MUTE }}>PLANO</p>
      <div className="space-y-2.5">
        {lista.map((x) => {
          const on = x.id === escolhido.id;
          return (
            <button key={x.id} type="button" onClick={() => setPlano(x.id)} aria-pressed={on}
              className="relative w-full rounded-[18px] p-4 text-left"
              style={on ? { border: `1.5px solid ${GOLD}`, background: "#171206", boxShadow: "0 18px 40px -22px rgba(255,200,0,.9)" } : { border: "1px solid #26241f", background: "#0e0e0f" }}>
              {x.selo && <span className="absolute -top-2.5 left-4 rounded-full px-2.5 py-1 text-[9px] font-black tracking-[.12em]" style={{ background: GOLD, color: "#1a1305" }}>{x.selo}</span>}
              <span className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-black">{x.nome}</span>
                {on && <Check className="w-5 h-5" style={{ color: GOLD }} strokeWidth={3} />}
              </span>
              <span className="block text-[24px] font-black tabular-nums leading-none mt-1.5" style={{ color: on ? GOLD : "#F4F1EA" }}>
                {x.preco}<span className="text-[12px] font-bold" style={{ color: MUTE }}>{x.por}</span>
              </span>
              <span className="block text-[12px] font-semibold mt-1.5" style={{ color: MUTE }}>{x.sub}</span>
            </button>
          );
        })}
      </div>

      <p className="font-mono text-[10.5px] font-bold tracking-[.2em] mt-8 mb-2.5" style={{ color: MUTE }}>PAGAMENTO</p>
      <div className="rounded-[18px] p-4" style={{ border: "1px solid #26241f", background: "#0e0e0f" }}>
        <p className="text-[15px] font-black">Pix ou cartão, pela Hotmart</p>
        <p className="text-[12.5px] mt-1 leading-snug" style={{ color: MUTE }}>Pix renova sozinho todo mês e a VANT avisa antes de vencer. Cancela quando quiser.</p>
      </div>

      {p && (
        <p className="text-center text-[13px] mt-8" style={{ color: "#b9b3a6" }}>
          Assinando como <b className="text-[#F4F1EA]">{p.nome ?? "você"}</b>{p.email ? <> · {p.email}</> : null}
        </p>
      )}
      {token && !quem.isLoading && !p && (
        <p className="text-center text-[12.5px] mt-8" style={{ color: "#ff9d8c" }}>Esse link venceu. Volte no app e toque em Assinar de novo.</p>
      )}

      <a href={href} target="_blank" rel="noopener noreferrer" onClick={aoClicarCheckout}
        className="mt-4 w-full h-[58px] rounded-[18px] inline-flex items-center justify-center text-[16px] font-black active:translate-y-[1px]"
        style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200", boxShadow: "0 12px 28px -12px rgba(255,200,0,.8)" }}>
        {escolhido.cta}
      </a>
      <p className="text-center text-[11px] mt-4 leading-relaxed" style={{ color: MUTE }}>
        Pagamento seguro pela Hotmart · 7 dias de garantia. Depois de pagar, volte no app e toque em "Tentar novamente".
        <br /><a href="/termos" className="underline">Termos</a> · <a href="/privacidade" className="underline">Privacidade</a>
      </p>
    </div>
  );
}
