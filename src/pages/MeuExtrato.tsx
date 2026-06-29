import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Loader2, Smartphone, CreditCard, Clock } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { formatCurrency } from "@/shared/lib/utils";
import { useMeuExtrato, type ExtratoSlot } from "@/hooks/useMeuExtrato";

// Tela do vendedor: manda o extrato do Pix e da maquininha pra comprovar as vendas.
// So o que ENTROU (card + pix) conta no desafio — dinheiro vivo nao conta.
export default function MeuExtrato() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const dia = getBrazilDate();
  const { pix, cartao, totalDia, upload } = useMeuExtrato(user?.id, dia);
  const [busy, setBusy] = useState<null | "pix" | "cartao">(null);
  const [error, setError] = useState("");

  const handleFile = async (tipo: "pix" | "cartao", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setBusy(tipo);
    const { ok } = await upload(tipo, file);
    if (!ok) setError("Não consegui ler esse extrato. Tenta de novo ou manda uma foto mais nítida.");
    setBusy(null);
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

      <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center text-center">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        Você tem até as 9h da manhã seguinte pra enviar. Pode reenviar quando quiser.
      </div>
    </div>
  );
}
