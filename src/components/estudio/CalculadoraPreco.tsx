import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { formatCurrency } from "@/shared/lib/utils";

// Calculadora de preço pelo MÉTODO MARKUP DIVISOR — o mesmo que a IA usa no chat.
// Preço = Custo ÷ (1 − (despesas% + lucro%)). É a conta honesta: o lucro e as
// despesas são fatia do PREÇO, não do custo. Multiplicar por 2 mente; dividir fala a verdade.

const num = (s: string) => {
  const v = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};

export default function CalculadoraPreco({
  open,
  onOpenChange,
  custoInicial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  custoInicial?: number;
}) {
  const [custo, setCusto] = useState(custoInicial ? String(custoInicial) : "");
  const [despesas, setDespesas] = useState("15"); // rua tem despesa baixa: Pix, embalagem, gás
  const [lucro, setLucro] = useState("40"); // rua prioriza margem: lucro que ele QUER, sobre o preço

  const r = useMemo(() => {
    const c = num(custo);
    const somaPct = (num(despesas) + num(lucro)) / 100;
    if (c <= 0 || somaPct <= 0 || somaPct >= 1) return null;
    const preco = c / (1 - somaPct);
    const despVal = preco * (num(despesas) / 100);
    const lucroVal = preco * (num(lucro) / 100);
    return { preco, despVal, lucroVal, margemBruta: ((preco - c) / preco) * 100 };
  }, [custo, despesas, lucro]);

  const somaInvalida = (num(despesas) + num(lucro)) >= 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" /> Calculadora de preço
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Custo do produto (CMV)</Label>
            <Input inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="Ex: 5,00" className="h-11" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Despesas / taxas (%)</Label>
              <Input inputMode="decimal" value={despesas} onChange={(e) => setDespesas(e.target.value)} placeholder="20" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Lucro que quero (%)</Label>
              <Input inputMode="decimal" value={lucro} onChange={(e) => setLucro(e.target.value)} placeholder="30" className="h-11" />
            </div>
          </div>

          {somaInvalida && (
            <p className="text-xs text-destructive">
              Despesas + lucro passaram de 100%. Baixe um dos dois — senão não existe preço que feche.
            </p>
          )}

          {r && (
            <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Preço de venda ideal</p>
              <p className="text-3xl font-bold text-primary leading-none">{formatCurrency(r.preco)}</p>
              <div className="pt-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Custo</span><span>{formatCurrency(num(custo))}</span></div>
                <div className="flex justify-between"><span>Despesas / taxas</span><span>{formatCurrency(r.despVal)}</span></div>
                <div className="flex justify-between font-semibold text-foreground"><span>Lucro limpo</span><span>{formatCurrency(r.lucroVal)}</span></div>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground leading-relaxed">
            Conta: <span className="text-foreground">Preço = Custo ÷ (1 − (despesas% + lucro%))</span>. O lucro sai limpo
            porque já descontou taxa, embalagem e o resto. Como o custo de rua é baixo, use a venda dupla: "1 por R$25,
            2 por R$35" — a 2ª unidade quase toda vira lucro e o cliente sente que economizou.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
