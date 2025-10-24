import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, CreditCard, Smartphone, Banknote, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DailySalesFormProps {
  userId: string;
  onSaved?: () => void;
}

export default function DailySalesForm({ userId, onSaved }: DailySalesFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    totalProfit: "",
    totalDebt: "",
    unpaidSales: "",
    cashSales: "",
    pixSales: "",
    cardSales: "",
    notes: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const salesData = {
        user_id: userId,
        date: new Date().toISOString().split('T')[0],
        total_profit: formData.totalProfit ? parseFloat(formData.totalProfit) : 0,
        total_debt: formData.totalDebt ? parseFloat(formData.totalDebt) : 0,
        unpaid_sales: formData.unpaidSales ? parseInt(formData.unpaidSales) : 0,
        cash_sales: formData.cashSales ? parseFloat(formData.cashSales) : 0,
        pix_sales: formData.pixSales ? parseFloat(formData.pixSales) : 0,
        card_sales: formData.cardSales ? parseFloat(formData.cardSales) : 0,
        notes: formData.notes
      };

      const { error } = await supabase
        .from("daily_sales")
        .upsert(salesData, { onConflict: 'user_id,date' });

      if (error) throw error;

      toast({
        title: "Vendas registradas!",
        description: "Seus dados do dia foram salvos com sucesso.",
      });

      if (onSaved) onSaved();
    } catch (error) {
      console.error("Error:", error);
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
          Registro de Vendas do Dia
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-success" />
                Lucro Total do Dia (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.totalProfit}
                onChange={(e) => setFormData({ ...formData, totalProfit: e.target.value })}
                className="relative z-10 cursor-text"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Calotes do Dia (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.totalDebt}
                onChange={(e) => setFormData({ ...formData, totalDebt: e.target.value })}
                className="relative z-10 cursor-text"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Número de Calotes (Vendas Não Pagas)
            </Label>
            <Input
              type="number"
              placeholder="0"
              value={formData.unpaidSales}
              onChange={(e) => setFormData({ ...formData, unpaidSales: e.target.value })}
              className="relative z-10 cursor-text"
            />
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
                  className="relative z-10 cursor-text"
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
                  className="relative z-10 cursor-text"
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
                  className="relative z-10 cursor-text"
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
              className="relative z-10 cursor-text"
            />
          </div>

          <Button 
            type="submit"
            className="w-full cursor-pointer hover:scale-105 transition-transform active:scale-95"
            disabled={isLoading}
          >
            {isLoading ? "Salvando..." : "Registrar Vendas do Dia"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
