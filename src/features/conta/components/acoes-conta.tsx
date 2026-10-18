/* End of the page: sign out, and — set apart — delete the account (never one tap). */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { supabase } from "@/shared/api";
import { toast } from "@/shared/hooks/use-toast";
import { avisar } from "@/shared/lib/avisar";
import { useAuth } from "@/hooks/useAuth";
import { Botao, COR, Folha, INPUT } from "@/shared/components/vant-ui";

export function AcoesConta() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [excluir, setExcluir] = useState(false);
  const [texto, setTexto] = useState("");
  const [apagando, setApagando] = useState(false);

  const sair = async () => { await signOut(); navigate("/auth"); };

  const apagar = async () => {
    if (texto.trim().toUpperCase() !== "EXCLUIR") return;
    setApagando(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-my-account", { body: { confirmacao: "EXCLUIR" } });
      const erroDados = (data as { error?: string } | null)?.error;
      if (error || erroDados) throw new Error(erroDados || error?.message || "erro");
      toast({ title: "Conta excluída", description: "Todos os seus dados foram apagados. Até logo!" });
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (e) {
      avisar.erro("conta: excluir", e);
      toast({ title: "Não deu pra excluir a conta", description: "Tente de novo ou fale com o suporte.", variant: "destructive" });
      setApagando(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pt-2">
      <button type="button" onClick={sair} className="h-12 rounded-2xl flex items-center justify-center gap-2 text-[14px] font-extrabold transition-transform duration-100 active:scale-[0.97]"
        style={{ background: COR.card, border: `1px solid ${COR.borda}` }}>
        <LogOut className="w-4 h-4" /> Sair da conta
      </button>
      <button type="button" onClick={() => { setTexto(""); setExcluir(true); }} className="self-center text-[12.5px] font-bold underline underline-offset-4" style={{ color: COR.coral }}>
        Excluir conta
      </button>

      <Folha aberta={excluir} onFechar={() => !apagando && setExcluir(false)} titulo="Excluir conta" sub="Isso não tem volta.">
        <ul className="flex flex-col gap-1.5 text-[13.5px]" style={{ color: COR.suave }}>
          <li>• Apaga suas vendas, metas, produtos, finanças e conversas.</li>
          <li>• Você sai do ranking e perde o histórico das competições e do X1.</li>
          <li>• Seu acesso acaba na hora. Se tiver assinatura na Hotmart, cancele lá também.</li>
        </ul>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-bold">Pra confirmar, digite <b style={{ color: COR.coral }}>EXCLUIR</b></span>
          <input className={`${INPUT} text-center tracking-[.2em] font-black`} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="EXCLUIR" autoComplete="off" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Botao onClick={() => setExcluir(false)} disabled={apagando}>Cancelar</Botao>
          <button type="button" onClick={apagar} disabled={apagando || texto.trim().toUpperCase() !== "EXCLUIR"}
            className="h-10 rounded-xl text-[13px] font-extrabold transition-transform duration-100 active:scale-[0.97] disabled:opacity-40"
            style={{ background: COR.coral, color: "#1A0806" }}>
            {apagando ? "Excluindo…" : "Excluir de vez"}
          </button>
        </div>
      </Folha>
    </div>
  );
}
