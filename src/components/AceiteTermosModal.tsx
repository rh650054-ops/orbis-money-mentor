import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/shared/ui/button";

// LGPD: aceite único dos Termos de Uso e da Política de Privacidade.
// Aparece UMA vez por usuário (por versão dos documentos) logo após o login;
// grava versão + data em profiles e nunca mais aparece. Se os documentos
// mudarem de forma relevante, basta subir TERMOS_VERSAO que todos re-aceitam.

export const TERMOS_VERSAO = "2026-07-28";

export default function AceiteTermosModal({ userId }: { userId: string }) {
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    supabase
      .from("profiles")
      .select("termos_aceitos_versao")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!vivo) return;
        const versao = (data as { termos_aceitos_versao?: string | null } | null)?.termos_aceitos_versao;
        setAberto(versao !== TERMOS_VERSAO);
      });
    return () => { vivo = false; };
  }, [userId]);

  const aceitar = async () => {
    setSalvando(true);
    const { error } = await supabase
      .from("profiles")
      .update({ termos_aceitos_versao: TERMOS_VERSAO, termos_aceitos_em: new Date().toISOString() } as never)
      .eq("user_id", userId);
    setSalvando(false);
    if (!error) setAberto(false);
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-background/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border p-5 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Seus dados, com transparência</h2>
            <p className="text-xs text-muted-foreground">Só precisa aceitar uma vez.</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Publicamos os{" "}
          <Link to="/termos" className="text-primary underline">Termos de Uso</Link> e a{" "}
          <Link to="/privacidade" className="text-primary underline">Política de Privacidade</Link>{" "}
          do Orbis, explicando quais dados usamos, pra quê, e os seus direitos (incluindo excluir a
          conta quando quiser). Pra continuar, confirme que leu e concorda.
        </p>
        <Button className="w-full h-11" onClick={aceitar} disabled={salvando}>
          {salvando ? "Salvando…" : "Li e aceito"}
        </Button>
      </div>
    </div>
  );
}
