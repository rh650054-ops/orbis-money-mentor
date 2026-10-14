/* /x1/carteira — a carteira do X1 fechou (Rick, 14/10/2026: X1 só por pontos).
   Quem abrir o endereço antigo (link salvo, PWA antigo) vê o aviso em vez de
   depósito/saque. Saldo antigo continua do vendedor: aparece aqui (só leitura)
   e o suporte devolve pelo Pix (admin: x1_admin_wallet_move). */
import { useNavigate } from "react-router-dom";
import { MessageCircle, Star, Swords } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { SkeletonCard } from "@/shared/components/skeletons";
import { useSaldoAntigoQuery } from "../api/use-saldo-antigo-query";

const GOLD = "#F5B800";
const SUPORTE = "https://wa.me/5511915054830?text=Ol%C3%A1%2C%20tenho%20saldo%20antigo%20na%20carteira%20do%20X1%20da%20Vant";

export default function CarteiraEncerradaPage() {
  const navigate = useNavigate();
  const saldo = useSaldoAntigoQuery();

  return (
    <div className="min-h-screen px-4 pt-4 pb-28 max-w-md mx-auto flex flex-col gap-3" style={{ background: "#000", color: "#F4F1EA" }}>
      <section className="rounded-[22px] px-5 py-6 flex flex-col items-center text-center gap-2"
        style={{ background: "radial-gradient(120% 90% at 50% 0%, rgba(245,184,0,.22), #0b0b0c 70%)", border: "1px solid rgba(245,184,0,.4)" }}>
        <span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: GOLD, color: "#1A1200" }}>
          <Star className="w-6 h-6" strokeWidth={2.6} />
        </span>
        <h1 className="text-[20px] font-black leading-tight">O X1 agora vale só pontos</h1>
        <p className="text-[13px] font-bold leading-snug" style={{ color: "#b9b3a6" }}>
          Não tem mais carteira, depósito, aposta nem prêmio em dinheiro. Quem vende mais no dia vence e ganha pontos
          pra subir de patente. Pontos não se compram, não se transferem e não viram dinheiro.
        </p>
      </section>

      {saldo.isLoading && <SkeletonCard />}
      {saldo.isError && (
        <p className="text-[12.5px] font-bold text-center" style={{ color: "#b9b3a6" }}>
          Não consegui ver seu saldo antigo agora. Se você tinha dinheiro na carteira, fala com o suporte.
        </p>
      )}
      {(saldo.data ?? 0) > 0 && (
        <section className="rounded-[18px] px-4 py-4 flex flex-col gap-2" style={{ background: "#0e0e10", border: "1px solid #26241f" }} aria-label="Saldo antigo">
          <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: GOLD }}>SEU SALDO ANTIGO</span>
          <span className="text-[30px] leading-none font-black tabular-nums">{formatCurrency(saldo.data ?? 0)}</span>
          <p className="text-[12.5px] font-bold leading-snug" style={{ color: "#b9b3a6" }}>
            Esse dinheiro continua seu. Fala com o suporte que a Vant devolve pelo Pix.
          </p>
          <a href={SUPORTE} target="_blank" rel="noreferrer" className="self-start h-10 px-4 rounded-[12px] text-[13px] font-black inline-flex items-center gap-2" style={{ background: GOLD, color: "#1A1200" }}>
            <MessageCircle className="w-4 h-4" /> Falar com o suporte
          </a>
        </section>
      )}

      <button type="button" onClick={() => navigate("/x1")} className="mt-1 h-12 rounded-2xl font-black inline-flex items-center justify-center gap-2" style={{ background: GOLD, color: "#1A1200" }}>
        <Swords className="w-4 h-4" strokeWidth={2.6} /> VOLTAR PRA ARENA
      </button>
    </div>
  );
}
