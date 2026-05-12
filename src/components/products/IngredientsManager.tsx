import { useState } from "react";
import { Plus, Pencil, Trash2, Bell, BellOff, Package2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useIngredients, UNIT_OPTIONS, Ingredient } from "@/hooks/useIngredients";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

const empty = {
  name: "",
  unit: "un",
  stock_quantity: "",
  stock_min: "",
  cost_per_unit: "",
  alerts_enabled: true,
};

export default function IngredientsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { ingredients, loading, reload, lowStock } = useIngredients();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (i: Ingredient) => {
    setEditing(i);
    setForm({
      name: i.name,
      unit: i.unit,
      stock_quantity: String(i.stock_quantity),
      stock_min: String(i.stock_min),
      cost_per_unit: String(i.cost_per_unit),
      alerts_enabled: i.alerts_enabled,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!user || !form.name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      unit: form.unit,
      stock_quantity: parseFloat(form.stock_quantity) || 0,
      stock_min: parseFloat(form.stock_min) || 0,
      cost_per_unit: parseFloat(form.cost_per_unit) || 0,
      alerts_enabled: form.alerts_enabled,
    };
    const { error } = editing
      ? await supabase.from("ingredients").update(payload).eq("id", editing.id)
      : await supabase.from("ingredients").insert(payload);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: editing ? "Ingrediente atualizado" : "Ingrediente cadastrado" });
      setOpen(false);
      reload();
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este ingrediente? As receitas que o usam também perderão a referência.")) return;
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Removido" }); reload(); }
  };

  const toggleAlerts = async (i: Ingredient) => {
    await supabase.from("ingredients").update({ alerts_enabled: !i.alerts_enabled }).eq("id", i.id);
    reload();
  };

  return (
    <div className="space-y-3">
      {lowStock.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-foreground">Mercadoria acabando ({lowStock.length})</p>
              <p className="text-muted-foreground mt-0.5">
                {lowStock.map((i) => i.name).join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Button onClick={openCreate} className="w-full" size="lg">
        <Plus className="w-4 h-4 mr-2" /> Nova mercadoria
      </Button>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-6">Carregando...</p>
      ) : ingredients.length === 0 ? (
        <Card className="glass">
          <CardContent className="p-6 text-center space-y-2">
            <Package2 className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Nenhuma mercadoria cadastrada</p>
            <p className="text-xs text-muted-foreground">
              Cadastre os insumos (leite, embalagens, etc) que você usa nas receitas.
            </p>
          </CardContent>
        </Card>
      ) : (
        ingredients.map((i) => {
          const low = i.alerts_enabled && i.stock_quantity <= i.stock_min;
          return (
            <Card key={i.id} className={low ? "border-warning/40" : ""}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{i.name}</p>
                    {low && <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning font-medium">acabando</span>}
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                    <span className="text-sm font-medium">
                      {Number(i.stock_quantity).toLocaleString("pt-BR")} {i.unit}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      mín {Number(i.stock_min).toLocaleString("pt-BR")} {i.unit}
                      {i.cost_per_unit > 0 && ` • ${formatCurrency(i.cost_per_unit)}/${i.unit}`}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => toggleAlerts(i)} title={i.alerts_enabled ? "Desativar alerta" : "Ativar alerta"}>
                  {i.alerts_enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(i)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(i.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar mercadoria" : "Nova mercadoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Leite condensado, embalagem 50ml" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Unidade</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Custo / unidade (R$)</Label>
                <Input type="number" inputMode="decimal" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} placeholder="0,00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Estoque atual</Label>
                <Input type="number" inputMode="decimal" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} placeholder="0" />
              </div>
              <div>
                <Label>Estoque mínimo</Label>
                <Input type="number" inputMode="decimal" value={form.stock_min} onChange={(e) => setForm({ ...form, stock_min: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div>
                <Label className="cursor-pointer">Alertar quando acabar</Label>
                <p className="text-[11px] text-muted-foreground">Avisa quando ficar abaixo do mínimo</p>
              </div>
              <Switch checked={form.alerts_enabled} onCheckedChange={(c) => setForm({ ...form, alerts_enabled: c })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
