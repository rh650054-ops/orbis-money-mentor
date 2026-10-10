/* ============================================================
   BANCO PRA CONTA DE PARCEIRO (Rick, 10/10/2026 — caso Yan)
   Influenciador / Equipe / Cortesia já tem o app de graça (billing_exempt).
   Ele não compra o Pro: compra só o banco. Pago o banco, o servidor já trata
   como Pro com selo (cortesia_com_banco_pago). Antes ele caía na paywall
   normal de R$ 34,90/R$ 49,90, como se fosse cliente.
   ============================================================ */
import { BANCO_EXTRA_CHECKOUT } from "@/shared/lib/checkout";
import { SeloVerificado } from "@/components/ranking/AvatarRanking";
import { PRECO_BANCO, brl } from "./pro-lib";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const MUTE = "#7b766e";
const INK2 = "#b9b3a6";

export function BancoParceiro({ rotulo, email }: { rotulo: string; email?: string | null }) {
  const link = BANCO_EXTRA_CHECKOUT
    ? `${BANCO_EXTRA_CHECKOUT}&sck=banco_parceiro${email ? `&email=${encodeURIComponent(email)}` : ""}`
    : null;
  return (
    <div className="space-y-3 pt-2">
      <div className="text-center space-y-2">
        <span className="mx-auto flex w-[72px] h-[72px] items-center justify-center" style={{ filter: "drop-shadow(0 0 16px rgba(0,149,246,.5))" }}>
          <SeloVerificado size={72} />
        </span>
        <span className="inline-block rounded-full px-3 py-[5px] text-[10px] font-black tracking-[.14em]"
          style={{ background: "rgba(245,184,0,.12)", border: "1px solid rgba(245,184,0,.45)", color: GOLD }}>
          CONTA {rotulo.toUpperCase()}
        </span>
        <h1 className="text-[23px] font-black tracking-[-.02em] leading-[1.1] text-balance">Seu app já é por nossa conta. Falta só o banco.</h1>
        <p className="text-[12.5px] leading-relaxed mx-auto max-w-[300px]" style={{ color: INK2 }}>
          Ligando o banco você ganha tudo do Pro: o selo no ranking e no X1, o Pix contado sozinho e o comprovante de renda.
        </p>
      </div>

      <div className="rounded-[20px] p-4 text-center" style={{ background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)", border: "1px solid rgba(245,184,0,.45)" }}>
        <p className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>SÓ O BANCO</p>
        <p className="text-[30px] font-black tabular-nums mt-1 leading-none">{brl(PRECO_BANCO)}<span className="text-[12px]" style={{ color: MUTE }}>/mês</span></p>
        <p className="text-[11.5px] mt-2" style={{ color: MUTE }}>cada leitura do banco tem custo pra Vant · cancela quando quiser</p>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer"
            className="mt-3.5 w-full h-[54px] rounded-[16px] inline-flex items-center justify-center text-[15px] font-black"
            style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
            LIGAR MEU BANCO · {brl(PRECO_BANCO)}
          </a>
        ) : (
          <p className="mt-3 text-[12px] font-extrabold" style={{ color: GOLD }}>Fala com o suporte da Vant pra liberar o banco.</p>
        )}
        <p className="mt-2.5 text-[11px] leading-relaxed" style={{ color: MUTE }}>
          Paga com o <b style={{ color: INK2 }}>mesmo e-mail e CPF</b> da sua conta Vant. Libera sozinho em até 1 minuto: depois volta na aba Vender e liga o banco.
        </p>
      </div>

      <p className="text-[10.5px] font-extrabold text-center flex justify-center gap-3" style={{ color: MUTE }}>
        <span><b style={{ color: OK }}>✓</b> Hotmart</span><span><b style={{ color: OK }}>✓</b> senha nunca passa pela Vant</span><span><b style={{ color: OK }}>✓</b> só leitura</span>
      </p>
    </div>
  );
}
