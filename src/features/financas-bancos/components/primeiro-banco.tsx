/* Bancos for a Pro account with no bank yet (28/11, Rick): an empty state in the approved design.
   The button is the SAME connect flow as everywhere (useLigarBanco: plan rules, bank limit, the
   extra-bank notice); nothing about eligibility is decided here. */
import { Landmark, Loader2, ShieldCheck } from "lucide-react";
import { BancoExtra } from "@/components/conectar/PapelContas";
import { useLigarBanco } from "@/features/vender";
import { Cartao, COR } from "@/features/financas-resumo";

export function PrimeiroBanco({ email }: { email?: string | null }) {
  const banco = useLigarBanco(false);
  return (
    <>
      <Cartao rotulo="Conecte seu primeiro banco" tom="ouro">
        <span className="w-12 h-12 rounded-[14px] grid place-items-center" style={{ background: "rgba(245,184,0,.12)", border: "1px solid rgba(245,184,0,.3)" }}>
          <Landmark className="w-6 h-6" style={{ color: COR.ouro }} aria-hidden />
        </span>
        <h2 className="text-[21px] font-black leading-tight mt-4" style={{ color: COR.texto }}>Todo o seu dinheiro em um só lugar.</h2>
        <p className="text-[14px] leading-relaxed mt-2" style={{ color: COR.sub }}>
          Conecte seu primeiro banco e acompanhe seus saldos, despesas, cartões e investimentos automaticamente.
        </p>
        <button type="button" onClick={() => void banco.ligar()} disabled={banco.ligando}
          className="w-full h-[52px] mt-5 rounded-[14px] font-black text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{ background: COR.ouro, color: "#1a1305" }}>
          {banco.ligando ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Abrindo o banco…</> : "Conectar meu primeiro banco"}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-[12.5px] font-semibold mt-3" style={{ color: COR.mute }}>
          <ShieldCheck className="w-4 h-4" style={{ color: COR.verde }} aria-hidden /> Conexão segura via Open Finance
        </p>
      </Cartao>
      {banco.precisaExtra && <BancoExtra usados={0} email={email} onFechar={banco.fecharExtra} />}
    </>
  );
}
