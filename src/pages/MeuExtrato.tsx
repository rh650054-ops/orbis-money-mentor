import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Loader2, Smartphone, CreditCard, Clock, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getExtratoDia } from "@/shared/lib/date-utils";
import { formatCurrency } from "@/shared/lib/utils";
import { toast } from "@/shared/hooks/use-toast";
import { useMeuExtrato, type ExtratoSlot } from "@/hooks/useMeuExtrato";

// Tela do vendedor: manda o extrato do Pix e da maquininha pra comprovar as vendas.
// So o que ENTROU (card + pix) conta no desafio — dinheiro vivo nao conta.
export default function MeuExtrato() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const dia = getExtratoDia();
  const diaLabel = `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  const { pix, cartao, totalDia, upload, uploadMes, remove } = useMeuExtrato(user?.id, dia);
  const [busy, setBusy] = useState<null | "pix" | "cartao">(null);
  const [busyMes, setBusyMes] = useState<null | "pix" | "cartao">(null);
  const [deleting, setDeleting] = useState<null | "pix" | "cartao">(null);
  const [error, setError] = useState("");

  const handleDelete = async (tipo: "pix" | "cartao") => {
    if (!window.confirm("Excluir esse extrato? Você pode enviar de novo depois.")) return;
    setError("");
    setDeleting(tipo);
    const { ok } = await remove(tipo);
    if (!ok) setError("Não consegui excluir agora. Tenta de novo.");
    setDeleting(null);
  };

  const handleFile = async (tipo: "pix" | "cartao", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setBusy(tipo);
    const r = await upload(tipo, file);
    if (!r.ok) {
      setError(r.erro ?? "Não consegui ler esse extrato. Tenta de novo ou manda uma foto mais nítida.");
    } else {
      const susp = r.suspeitas?.length ?? 0;
      if (susp > 0 || r.acimaDoDefcon) {
        toast({
          title: "Extrato conferido — com avisos",
          description: `${susp > 0 ? `${susp} venda(s) suspeita(s) ignorada(s). ` : ""}${r.acimaDoDefcon ? "Passou do total do DEFCON — marcado pra revisão." : ""}`.trim(),
        });
      }
    }
    setBusy(null);
    if (e.target) e.target.value = "";
  };

  // Extrato do MES: preenche os dias que ficaram sem extrato (so dias com DEFCON iniciado).
  const handleFileMes = async (tipo: "pix" | "cartao", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setBusyMes(tipo);
    const r = await uploadMes(tipo, file);
    if (!r.ok) {
      setError(r.erro ?? "Não consegui ler esse extrato. Tenta um PDF ou print mais nítido.");
    } else {
      const salvos = r.diasSalvos ?? [];
      const pulados = r.diasPulados ?? [];
      const fmtD = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
      toast({
        title: salvos.length > 0 ? `${salvos.length} dia(s) preenchido(s)!` : "Nenhum dia novo pra preencher",
        description: [
          salvos.length > 0 ? `Salvos: ${salvos.map((d) => `${fmtD(d.dia)} (${formatCurrency(d.total)})`).join(", ")}.` : "",
          pulados.length > 0 ? `Pulados: ${pulados.map((d) => `${fmtD(d.dia)} — ${d.motivo}`).join("; ")}.` : "",
        ].filter(Boolean).join(" "),
      });
    }
    setBusyMes(null);
    if (e.target) e.target.value = "";
  };

  const renderSlot = (tipo: "pix" | "cartao", label: string, Icon: typeof Smartphone, slot: ExtratoSlot | null) => (
    <Card className={slot ? "border-emerald-500/40" : "border-dashed border-primary/30"}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${slot ? "bg-emerald-500/15 text-emerald-500" : "bg-muted/40 text-primary"}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-bold">{label}</p>
            {slot ? (
              <p className="text-xs text-emerald-500 font-semibold">
                ✓ {formatCurrency(slot.total_verificado)} · {slot.qtd_vendas} vendas
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Ainda não enviado</p>
            )}
          </div>
        </div>
        <label className="block">
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(tipo, e)}
            disabled={busy !== null}
          />
          <span className={`cursor-pointer w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${slot ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}>
            {busy === tipo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {busy === tipo ? "Lendo..." : slot ? "Reenviar" : "Enviar extrato"}
          </span>
        </label>
        {slot && (
          <button
            onClick={() => handleDelete(tipo)}
            disabled={deleting !== null || busy !== null}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-destructive bg-destructive/10 disabled:opacity-60"
          >
            {deleting === tipo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {deleting === tipo ? "Excluindo..." : "Excluir extrato"}
          </button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-5 pb-8 max-w-xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meu extrato do dia</h1>
          <p className="text-sm text-muted-foreground">Comprove suas vendas pra valer no ranking</p>
        </div>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Mande o extrato do <b className="text-foreground">Pix</b> e o da <b className="text-foreground">maquininha</b>.
          A IA conta só o que <b className="text-foreground">entrou</b> (cartão + pix). Dinheiro vivo não conta no desafio.
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {renderSlot("pix", "Extrato Pix", Smartphone, pix)}
      {renderSlot("cartao", "Extrato Cartão", CreditCard, cartao)}

      <Card>
        <CardContent className="p-5 flex justify-between items-center">
          <span className="font-bold">Total verificado hoje</span>
          <span className="text-2xl font-black text-emerald-500">{formatCurrency(totalDia)}</span>
        </CardContent>
      </Card>

      {/* Extrato do MES: preenche dias esquecidos (so dias com DEFCON iniciado e sem extrato) */}
      <Card className="border-dashed border-primary/30">
        <CardContent className="p-5 space-y-3">
          <p className="font-bold">Esqueceu de enviar algum dia? Passou das 9h?</p>
          <p className="text-xs text-muted-foreground">
            Manda o extrato do <b className="text-foreground">mês inteiro</b> — pode ser a <b className="text-foreground">qualquer
            hora do dia</b>. A IA separa por dia e preenche o que entrou em cada dia que você trabalhou
            (DEFCON iniciado) e ainda está sem extrato. Não mexe nos dias já enviados.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["pix", "cartao"] as const).map((t) => (
              <label key={t} className="block">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => handleFileMes(t, e)}
                  disabled={busy !== null || busyMes !== null}
                />
                <span className="cursor-pointer w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold bg-muted text-foreground">
                  {busyMes === t ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {busyMes === t ? "Lendo o mês..." : t === "pix" ? "Mês — Pix" : "Mês — Cartão"}
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center text-center">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        Os cards de cima contam pro dia {diaLabel} · envie até as 9h da manhã (pra contar Pix atrasado). Pode reenviar.
        Perdeu o horário ou esqueceu um dia? Usa o card do mês aí em cima — esse vale a qualquer hora.
      </div>
    </div>
  );
}
