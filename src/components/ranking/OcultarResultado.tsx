import { useEffect, useState } from "react";
import { EyeOff, Eye, Loader2 } from "lucide-react";
import { Switch } from "@/shared/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/shared/hooks/use-toast";
import { syncLeaderboardRevenue } from "@/utils/syncDailySales";

/**
 * "Ocultar meu resultado": o vendedor escolhe ficar FORA do ranking.
 * Padrão = participando. Ao ligar, a linha dele some do ranking na hora
 * (RPC ranking_definir_oculto apaga a entrada do mês). Ao desligar, o Orbis
 * recalcula o mês dele e ele volta pra lista.
 */
type Props = {
  userId: string;
  oculto: boolean | null;
  setOculto: (v: boolean | null) => void;
  /** chamado quando a escolha muda, pra tela recarregar a lista */
  onMudou: (oculto: boolean) => void;
};

export function useRankingOculto(userId?: string) {
  const [oculto, setOculto] = useState<boolean | null>(null);
  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    (supabase.from("profiles") as any)
      .select("ranking_oculto")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }: { data: { ranking_oculto?: boolean } | null }) => {
        if (vivo) setOculto(!!data?.ranking_oculto);
      });
    return () => { vivo = false; };
  }, [userId]);
  return [oculto, setOculto] as const;
}

export function OcultarResultado({ userId, oculto, setOculto, onMudou }: Props) {
  const [salvando, setSalvando] = useState(false);

  const alternar = async (valor: boolean) => {
    if (salvando) return;
    setSalvando(true);
    const antes = oculto;
    setOculto(valor);
    try {
      const { error } = await (supabase.rpc as any)("ranking_definir_oculto", { p_oculto: valor });
      if (error) throw error;
      if (!valor) {
        // voltou pro ranking: recalcula o mês dele agora, sem esperar o próximo fechamento
        try { await syncLeaderboardRevenue(userId); } catch { /* o próximo fechamento refaz */ }
      }
      toast({
        title: valor ? "Seu resultado está oculto" : "Você voltou pro ranking",
        description: valor
          ? "Ninguém vê seu faturamento nem sua posição. Desligue quando quiser voltar."
          : "Seu faturamento do mês já conta de novo.",
      });
      onMudou(valor);
    } catch {
      setOculto(antes);
      toast({ title: "Não deu pra salvar", description: "Tenta de novo em instantes.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  if (oculto === null) return null;

  return (
    <div
      className={
        "flex items-center gap-3 rounded-2xl border px-3.5 py-3 " +
        (oculto ? "border-amber-500/40 bg-amber-500/10" : "border-border/60 bg-card/60")
      }
      data-tour="ranking-ocultar"
    >
      <div className={"grid h-9 w-9 shrink-0 place-items-center rounded-full " + (oculto ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground")}>
        {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : oculto ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight text-foreground">Ocultar meu resultado</p>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {oculto
            ? "Você está fora do ranking. Ninguém vê seu faturamento."
            : "Ligue pra sair do ranking. Seu faturamento continua só seu."}
        </p>
      </div>
      <Switch checked={!!oculto} onCheckedChange={alternar} disabled={salvando} aria-label="Ocultar meu resultado no ranking" />
    </div>
  );
}

export default OcultarResultado;
