/* ============================================================
   /mp/retorno — o Mercado Pago devolve o vendedor aqui depois que ele autoriza.
   A tela pega o "code" e o "state" do endereço, manda pra função mp-callback
   (que troca por um token no servidor) e leva de volta pra Finanças.
   O code não serve pra nada sozinho: só vale com o segredo que fica no servidor.
   Todo hook acima do primeiro return.
   ============================================================ */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const OK = "#3DD68C";
const RED = "#F2465A";
const MP_AZUL = "#00B1EA";

export default function MpRetorno() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [estado, setEstado] = useState<"ligando" | "ok" | "erro">("ligando");
  const [msg, setMsg] = useState("");
  const [vendas, setVendas] = useState(0);

  useEffect(() => {
    if (loading) return;
    const code = params.get("code");
    const state = params.get("state");
    const erroMp = params.get("error");
    if (erroMp) { setEstado("erro"); setMsg("Você cancelou a autorização no Mercado Pago."); return; }
    if (!code || !state) { setEstado("erro"); setMsg("O Mercado Pago não devolveu o código. Tenta conectar de novo."); return; }
    if (!user) { setEstado("erro"); setMsg("Entre na sua conta do Orbis e conecte de novo."); return; }
    let vivo = true;
    (async () => {
      const { data, error } = await (supabase as any).functions.invoke("mp-callback", { body: { code, state } });
      if (!vivo) return;
      if (error || data?.error) {
        setEstado("erro");
        setMsg(
          data?.error === "mp_nao_configurado" ? "O Orbis ainda não está configurado pra isso. Avisa o suporte."
          : data?.error === "state_invalido" ? "Esse link já foi usado. Toque em conectar de novo."
          : data?.error === "expirou" ? "A autorização demorou demais. Tenta de novo."
          : "Não deu pra fechar a conexão. Tenta de novo em instantes.",
        );
        return;
      }
      setVendas(Number(data?.vendas) || 0);
      setEstado("ok");
      setTimeout(() => navigate("/finances", { replace: true }), 2200);
    })();
    return () => { vivo = false; };
  }, [loading, user, params, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: "#000" }}>
      {estado === "ligando" && (
        <>
          <span className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `${MP_AZUL}1a`, border: `2px solid ${MP_AZUL}66` }}>
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: MP_AZUL }} />
          </span>
          <p className="text-[17px] font-black mt-5">Ligando sua conta…</p>
          <p className="text-[12.5px] mt-1.5" style={{ color: "var(--orbis-fg-2)" }}>Só um instante. Não feche o app.</p>
        </>
      )}
      {estado === "ok" && (
        <>
          <span className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `${OK}1a`, border: `2px solid ${OK}`, boxShadow: `0 0 40px ${OK}44` }}>
            <Check className="w-8 h-8" style={{ color: OK }} strokeWidth={3} />
          </span>
          <p className="text-[20px] font-black mt-5">Mercado Pago conectado</p>
          <p className="text-[12.5px] mt-1.5" style={{ color: "var(--orbis-fg-2)" }}>
            {vendas > 0 ? `Já encontrei ${vendas} ${vendas === 1 ? "venda" : "vendas"} pra você conferir.` : "A partir de agora suas vendas aparecem sozinhas."}
          </p>
          <p className="text-[11.5px] mt-3" style={{ color: "var(--orbis-fg-3)" }}>Levando você pra Finanças…</p>
        </>
      )}
      {estado === "erro" && (
        <>
          <span className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `${RED}1a`, border: `2px solid ${RED}66` }}>
            <AlertTriangle className="w-7 h-7" style={{ color: RED }} strokeWidth={2.4} />
          </span>
          <p className="text-[17px] font-black mt-5">Não deu certo</p>
          <p className="text-[12.5px] mt-1.5 max-w-xs" style={{ color: "var(--orbis-fg-2)" }}>{msg}</p>
          <button type="button" onClick={() => navigate("/finances", { replace: true })} className="orbis-cta mt-5 px-6">VOLTAR PRA FINANÇAS</button>
        </>
      )}
    </div>
  );
}
