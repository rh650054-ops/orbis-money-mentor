import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { toast } from "@/shared/hooks/use-toast";
import { getExtratoDeadlineHour, setExtratoDeadline } from "@/shared/lib/extrato-config";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";

// Admin: muda o horário-limite pra envio do extrato (sem código).
export default function AdminExtratoConfig() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { whitelisted, role, loading } = useAdminAccess(user?.id);
  const isAdmin = whitelisted && role === "admin";
  const [hour, setHour] = useState(String(getExtratoDeadlineHour()));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const h = Number(hour);
    if (!Number.isFinite(h) || h < 0 || h > 23) {
      toast({ title: "Horário inválido", description: "Use um número de 0 a 23.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const r = await setExtratoDeadline(h);
    setSaving(false);
    if (!r.ok) {
      toast({ title: "Não consegui salvar", description: r.error, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Horário atualizado", description: `O extrato do dia fecha às ${Math.round(h)}h da manhã seguinte.` });
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!isAdmin)
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-bold">Acesso restrito</p>
        <button onClick={() => navigate("/")} className="mt-3 text-primary underline">Voltar</button>
      </div>
    );

  return (
    <div className="pb-24 px-4 pt-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/40 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Clock className="w-6 h-6 text-amber-400" /> Horário do extrato
          </h1>
          <p className="text-sm text-muted-foreground">Até que horas o extrato do dia pode ser enviado</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          O extrato de um dia pode ser enviado até esse horário da <b className="text-foreground">manhã seguinte</b> — pra dar tempo do Pix atrasado cair. Depois dele, o dia fecha e o próximo passa a valer. Ex: <b className="text-foreground">9</b> = até as 9h.
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-[11px] text-muted-foreground">Horário-limite (0 a 23)</label>
            <input
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full h-11 px-3 rounded-lg bg-card border border-border text-lg font-bold text-foreground"
            />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Salvar
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Vale pro popup do fim do DEFCON, o lembrete e o corte do dia. Passa a valer pra todos os usuários no próximo carregamento do app deles.
        </p>
      </div>
    </div>
  );
}
