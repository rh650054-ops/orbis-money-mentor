import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, CreditCard, Smartphone, Banknote, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const salesSchema = z.object({
  totalProfit: z.string().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 999999;
  }, { message: "Lucro deve ser entre 0 e 999.999" }),
  cost: z.string().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 999999;
  }, { message: "Custo deve ser entre 0 e 999.999" }),
  totalDebt: z.string().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 999999;
  }, { message: "Calotes devem ser entre 0 e 999.999" }),
  cashSales: z.string().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 999999;
  }, { message: "Vendas em dinheiro devem ser entre 0 e 999.999" }),
  pixSales: z.string().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 999999;
  }, { message: "Vendas em Pix devem ser entre 0 e 999.999" }),
  cardSales: z.string().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 999999;
  }, { message: "Vendas em cartão devem ser entre 0 e 999.999" }),
  notes: z.string().max(1000, { message: "Observações devem ter no máximo 1000 caracteres" }).optional()
});

interface DailySalesFormProps {
  userId: string;
  onSaved?: () => void;
}

export default function DailySalesForm({ userId, onSaved }: DailySalesFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    totalProfit: "",
    cost: "",
    totalDebt: "",
    cashSales: "",
    pixSales: "",
    cardSales: "",
    notes: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate form data
      const validation = salesSchema.safeParse(formData);
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        toast({
          title: "Erro de validação",
          description: firstError.message,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      const salesData = {
        user_id: userId,
        date: new Date().toISOString().split('T')[0],
        total_profit: formData.totalProfit ? parseFloat(formData.totalProfit) : 0,
        cost: formData.cost ? parseFloat(formData.cost) : 0,
        total_debt: formData.totalDebt ? parseFloat(formData.totalDebt) : 0,
        cash_sales: formData.cashSales ? parseFloat(formData.cashSales) : 0,
        pix_sales: formData.pixSales ? parseFloat(formData.pixSales) : 0,
        card_sales: formData.cardSales ? parseFloat(formData.cardSales) : 0,
        notes: formData.notes.trim()
      };

      // Insert new record (not upsert) to maintain transaction history
      const { error } = await supabase
        .from("daily_sales")
        .insert(salesData);

      if (error) throw error;

      toast({
        title: "✅ Lançamento salvo com sucesso!",
        description: "Seu lançamento foi registrado no histórico.",
      });

      // Clear form after successful save
      setFormData({
        totalProfit: "",
        cost: "",
        totalDebt: "",
        cashSales: "",
        pixSales: "",
        cardSales: "",
        notes: ""
      });

      if (onSaved) onSaved();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar os dados.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="card-gradient-border shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <DollarSign className="h-5 w-5 text-primary" />
          Novo Lançamento
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Registre cada venda individualmente para manter histórico completo
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-success" />
                Total Vendido (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.totalProfit}
                onChange={(e) => setFormData({ ...formData, totalProfit: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-warning" />
                Gasto em Mercadoria (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Calotes (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.totalDebt}
                onChange={(e) => setFormData({ ...formData, totalDebt: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold">Vendas por Método de Pagamento</Label>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-success" />
                  Dinheiro (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.cashSales}
                  onChange={(e) => setFormData({ ...formData, cashSales: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  Pix (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.pixSales}
                  onChange={(e) => setFormData({ ...formData, pixSales: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-secondary" />
                  Cartão (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.cardSales}
                  onChange={(e) => setFormData({ ...formData, cardSales: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Adicione detalhes sobre o dia..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              maxLength={1000}
            />
          </div>

          <Button 
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "⏳ Salvando..." : "💰 Registrar Lançamento"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
