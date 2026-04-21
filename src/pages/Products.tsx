import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  Plus,
  Pencil,
  Trash2,
  QrCode,
  AlertTriangle,
  Image as ImageIcon,
  Copy,
  Check,
  Landmark,
  Star,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QRCodeSVG } from "qrcode.react";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
// pix_accounts/products.open_price ainda não estão nos types gerados
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseTyped as any;
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { generatePixPayload } from "@/lib/pixCode";
import { BRAZILIAN_BANKS, getBankById } from "@/lib/brazilianBanks";

interface Product {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  cost: number;
  sale_price: number;
  stock_quantity: number;
  stock_min: number;
  open_price: boolean;
  pix_account_id: string | null;
}

interface PixAccount {
  id: string;
  bank_name: string;
  pix_key: string;
  pix_key_type: string;
  merchant_name: string;
  merchant_city: string;
  is_default: boolean;
}

const emptyForm = {
  name: "",
  description: "",
  cost: "",
  sale_price: "",
  stock_quantity: "",
  stock_min: "",
  photo_url: "",
  open_price: false,
  pix_account_id: "",
};

const emptyPixForm = {
  bank_name: "",
  pix_key: "",
  pix_key_type: "cpf",
  merchant_name: "",
  merchant_city: "",
};

export default function Products() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [pixAccounts, setPixAccounts] = useState<PixAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Product form
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // QR modal
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [copied, setCopied] = useState(false);

  // Pix accounts manager
  const [pixManagerOpen, setPixManagerOpen] = useState(false);
  const [editingPix, setEditingPix] = useState<PixAccount | null>(null);
  const [pixForm, setPixForm] = useState(emptyPixForm);

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const [prodRes, pixRes, profRes] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("pix_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("nickname, city")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    if (prodRes.data) setProducts(prodRes.data as Product[]);
    if (pixRes.data) setPixAccounts(pixRes.data as PixAccount[]);
    if (profRes.data) setProfileDefaults({
      name: profRes.data.nickname || "",
      city: (profRes.data.city || "").toUpperCase(),
    });
    setLoading(false);
  };

  const defaultPixAccount = pixAccounts.find((a) => a.is_default) || pixAccounts[0] || null;

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      pix_account_id: defaultPixAccount?.id || "",
    });
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || "",
      cost: String(p.cost),
      sale_price: String(p.sale_price),
      stock_quantity: String(p.stock_quantity),
      stock_min: String(p.stock_min),
      photo_url: p.photo_url || "",
      open_price: p.open_price,
      pix_account_id: p.pix_account_id || defaultPixAccount?.id || "",
    });
    setFormOpen(true);
  };

  const handlePhoto = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Foto muito grande", description: "Máximo 5MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-photos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast({ title: "Erro ao enviar foto", description: error.message, variant: "destructive" });
    } else {
      const { data } = supabase.storage.from("product-photos").getPublicUrl(path);
      setForm((f) => ({ ...f, photo_url: data.publicUrl }));
    }
    setUploading(false);
  };

  const saveProduct = async () => {
    if (!user) return;
    if (!form.name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      photo_url: form.photo_url || null,
      cost: parseFloat(form.cost) || 0,
      sale_price: form.open_price ? 0 : parseFloat(form.sale_price) || 0,
      stock_quantity: parseInt(form.stock_quantity) || 0,
      stock_min: parseInt(form.stock_min) || 0,
      open_price: form.open_price,
      pix_account_id: form.pix_account_id || null,
    };
    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editing ? "Produto atualizado" : "Produto criado" });
      setFormOpen(false);
      loadAll();
    }
    setSaving(false);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);
    if (!error) {
      toast({ title: "Produto removido" });
      loadAll();
    }
  };

  // ---------- Pix accounts CRUD ----------
  const openPixManager = () => {
    setEditingPix(null);
    setPixForm(emptyPixForm);
    setPixManagerOpen(true);
  };

  const editPixAccount = (a: PixAccount) => {
    setEditingPix(a);
    setPixForm({
      bank_name: a.bank_name,
      pix_key: a.pix_key,
      pix_key_type: a.pix_key_type,
      merchant_name: a.merchant_name,
      merchant_city: a.merchant_city,
    });
  };

  const savePixAccount = async () => {
    if (!user) return;
    if (!pixForm.bank_name.trim() || !pixForm.pix_key.trim() || !pixForm.merchant_name.trim() || !pixForm.merchant_city.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    const payload = {
      user_id: user.id,
      bank_name: pixForm.bank_name.trim(),
      pix_key: pixForm.pix_key.trim(),
      pix_key_type: pixForm.pix_key_type,
      merchant_name: pixForm.merchant_name.trim(),
      merchant_city: pixForm.merchant_city.trim(),
      is_default: editingPix?.is_default ?? pixAccounts.length === 0,
    };
    const { error } = editingPix
      ? await supabase.from("pix_accounts").update(payload).eq("id", editingPix.id)
      : await supabase.from("pix_accounts").insert(payload);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingPix ? "Conta atualizada" : "Conta Pix adicionada" });
      setEditingPix(null);
      setPixForm(emptyPixForm);
      loadAll();
    }
  };

  const setDefaultPix = async (id: string) => {
    if (!user) return;
    await supabase.from("pix_accounts").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("pix_accounts").update({ is_default: true }).eq("id", id);
    loadAll();
  };

  const deletePixAccount = async (id: string) => {
    if (!confirm("Excluir esta conta Pix?")) return;
    await supabase.from("pix_accounts").delete().eq("id", id);
    loadAll();
  };

  // ---------- QR Code ----------
  const getProductPixAccount = (p: Product) =>
    pixAccounts.find((a) => a.id === p.pix_account_id) || defaultPixAccount;

  const buildPayload = (p: Product, amountOverride?: number) => {
    const acc = getProductPixAccount(p);
    if (!acc) return "";
    const amount = p.open_price ? amountOverride : p.sale_price;
    return generatePixPayload({
      pixKey: acc.pix_key,
      amount: amount && amount > 0 ? amount : undefined,
      merchantName: acc.merchant_name,
      merchantCity: acc.merchant_city,
      txid: p.id.slice(0, 8),
    });
  };

  const openQr = (p: Product) => {
    setQrProduct(p);
    setCustomAmount("");
  };

  const currentQrAmount = qrProduct?.open_price
    ? parseFloat(customAmount) || 0
    : qrProduct?.sale_price || 0;

  const currentPayload = qrProduct ? buildPayload(qrProduct, currentQrAmount) : "";

  const copyPayload = async () => {
    if (!currentPayload) return;
    await navigator.clipboard.writeText(currentPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Stats
  const lowStock = products.filter((p) => p.stock_quantity <= p.stock_min);
  const totalStockValue = products.reduce((s, p) => s + p.cost * p.stock_quantity, 0);
  const hasNoPix = pixAccounts.length === 0;

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-2xl mx-auto px-4">
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold gradient-text truncate">Produtos & Estoque</h1>
            <p className="text-xs text-muted-foreground">
              {pixAccounts.length} conta{pixAccounts.length !== 1 ? "s" : ""} Pix • QR por produto
            </p>
          </div>
        </div>
        <Button size="icon" variant="outline" onClick={openPixManager} title="Contas Pix">
          <Landmark className="w-4 h-4" />
        </Button>
      </div>

      {hasNoPix && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Cadastre uma conta Pix</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Adicione seus bancos (Nubank, Itaú, Bradesco…) para gerar QR Code em cada produto.
              </p>
              <Button size="sm" variant="outline" className="mt-2 h-8" onClick={openPixManager}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar conta Pix
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="stock">
            Estoque {lowStock.length > 0 && <span className="ml-1.5 text-warning">●</span>}
          </TabsTrigger>
        </TabsList>

        {/* PRODUTOS */}
        <TabsContent value="products" className="space-y-3 mt-4">
          <Button onClick={openCreate} className="w-full" size="lg">
            <Plus className="w-4 h-4 mr-2" /> Novo produto
          </Button>

          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
          ) : products.length === 0 ? (
            <Card className="glass">
              <CardContent className="p-8 text-center space-y-2">
                <Package className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhum produto cadastrado</p>
              </CardContent>
            </Card>
          ) : (
            products.map((p) => {
              const margin = p.sale_price - p.cost;
              const marginPct = p.sale_price > 0 ? (margin / p.sale_price) * 100 : 0;
              const acc = getProductPixAccount(p);
              return (
                <Card key={p.id} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>
                        )}
                        <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                          {p.open_price ? (
                            <span className="text-base font-bold text-primary">A combinar</span>
                          ) : (
                            <>
                              <span className="text-base font-bold text-primary">
                                {formatCurrency(p.sale_price)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                custo {formatCurrency(p.cost)} • {marginPct.toFixed(0)}%
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <p className="text-[11px] text-muted-foreground">
                            Estoque:{" "}
                            <span
                              className={
                                p.stock_quantity <= p.stock_min ? "text-warning font-semibold" : "font-semibold"
                              }
                            >
                              {p.stock_quantity}
                            </span>
                          </p>
                          {acc && (
                            <span className="text-[10px] text-muted-foreground">
                              • {acc.bank_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => openQr(p)}
                        disabled={hasNoPix}
                      >
                        <QrCode className="w-3.5 h-3.5 mr-1.5" /> QR Pix
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteProduct(p.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ESTOQUE */}
        <TabsContent value="stock" className="space-y-3 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Valor em estoque</p>
                <p className="text-lg font-bold mt-1">{formatCurrency(totalStockValue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Estoque baixo</p>
                <p className="text-lg font-bold mt-1 text-warning">{lowStock.length}</p>
              </CardContent>
            </Card>
          </div>

          {lowStock.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">
                ⚠️ Repor estoque
              </p>
              <div className="space-y-2">
                {lowStock.map((p) => (
                  <Card key={p.id} className="border-warning/40">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0">
                        {p.photo_url && <img src={p.photo_url} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        <p className="text-xs text-warning">
                          {p.stock_quantity} restante(s) • mín {p.stock_min}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                        Repor
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1 mt-4">
            Todos os produtos
          </p>
          {products.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0">
                  {p.photo_url && <img src={p.photo_url} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(p.cost * p.stock_quantity)} em estoque
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-lg font-bold ${
                      p.stock_quantity <= p.stock_min ? "text-warning" : ""
                    }`}
                  >
                    {p.stock_quantity}
                  </p>
                  <p className="text-[10px] text-muted-foreground">un</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* PRODUCT FORM MODAL */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Foto */}
            <div className="flex items-center gap-3">
              <label className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex items-center justify-center cursor-pointer hover:bg-muted/70 transition shrink-0">
                {form.photo_url ? (
                  <img src={form.photo_url} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])}
                />
              </label>
              <div className="text-xs text-muted-foreground">
                {uploading ? "Enviando..." : "Toque para adicionar foto (até 5MB)"}
              </div>
            </div>

            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {/* Preço aberto toggle */}
            <Card className="bg-muted/30 border-border/50">
              <CardContent className="p-3 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <Label htmlFor="open-price" className="font-medium">Preço aberto</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Para vendas com valor combinado na hora. O QR Pix vai sem valor — o cliente digita.
                  </p>
                </div>
                <Switch
                  id="open-price"
                  checked={form.open_price}
                  onCheckedChange={(v) => setForm({ ...form, open_price: v })}
                />
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Custo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                />
              </div>
              <div>
                <Label className={form.open_price ? "text-muted-foreground" : ""}>
                  Venda (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.open_price ? "" : form.sale_price}
                  disabled={form.open_price}
                  placeholder={form.open_price ? "—" : ""}
                  onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                />
              </div>
              <div>
                <Label>Estoque atual</Label>
                <Input
                  type="number"
                  value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                />
              </div>
              <div>
                <Label>Mínimo</Label>
                <Input
                  type="number"
                  value={form.stock_min}
                  onChange={(e) => setForm({ ...form, stock_min: e.target.value })}
                />
              </div>
            </div>

            {/* Conta Pix */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Receber Pix em</Label>
                <button
                  type="button"
                  className="text-[11px] text-primary hover:underline"
                  onClick={openPixManager}
                >
                  + Nova conta
                </button>
              </div>
              {pixAccounts.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                  Cadastre uma conta Pix primeiro para gerar QR Code.
                </p>
              ) : (
                <Select
                  value={form.pix_account_id}
                  onValueChange={(v) => setForm({ ...form, pix_account_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {pixAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.bank_name} {a.is_default && "⭐"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveProduct} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR MODAL */}
      <Dialog open={!!qrProduct} onOpenChange={(o) => !o && setQrProduct(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{qrProduct?.name}</DialogTitle>
          </DialogHeader>
          {qrProduct && (
            <div className="space-y-4 text-center">
              {qrProduct.open_price && (
                <div className="text-left">
                  <Label>Valor desta venda (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    autoFocus
                    placeholder="Digite o valor combinado"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                  />
                </div>
              )}

              {currentPayload ? (
                <>
                  <div className="bg-white p-4 rounded-xl mx-auto inline-block">
                    <QRCodeSVG value={currentPayload} size={220} level="M" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor a receber</p>
                    <p className="text-2xl font-bold text-primary">
                      {currentQrAmount > 0 ? formatCurrency(currentQrAmount) : "Cliente digita"}
                    </p>
                  </div>
                  <Button onClick={copyPayload} variant="outline" className="w-full">
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copied ? "Copiado!" : "Copiar Pix Copia e Cola"}
                  </Button>
                  {(() => {
                    const acc = getProductPixAccount(qrProduct);
                    return acc ? (
                      <p className="text-[10px] text-muted-foreground">
                        {acc.bank_name} • {acc.merchant_name} • {acc.merchant_city}
                      </p>
                    ) : null;
                  })()}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-8">
                  {qrProduct.open_price ? "Digite o valor para gerar o QR" : "Configure uma conta Pix"}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PIX ACCOUNTS MANAGER */}
      <Dialog open={pixManagerOpen} onOpenChange={setPixManagerOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contas Pix</DialogTitle>
          </DialogHeader>

          {/* Lista */}
          {pixAccounts.length > 0 && !editingPix && (
            <div className="space-y-2">
              {pixAccounts.map((a) => (
                <Card key={a.id} className={a.is_default ? "border-primary/50" : ""}>
                  <CardContent className="p-3 flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm truncate">{a.bank_name}</p>
                        {a.is_default && <Star className="w-3 h-3 text-primary fill-primary" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {a.pix_key_type.toUpperCase()} • {a.pix_key}
                      </p>
                    </div>
                    {!a.is_default && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDefaultPix(a.id)} title="Tornar padrão">
                        <Star className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editPixAccount(a)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deletePixAccount(a.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Form */}
          <div className="space-y-3 pt-2 border-t border-border/40">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {editingPix ? "Editar conta" : "Adicionar nova conta"}
            </p>
            <div>
              <Label>Apelido / Banco</Label>
              <Input
                placeholder="Ex: Nubank, Itaú, Bradesco"
                value={pixForm.bank_name}
                onChange={(e) => setPixForm({ ...pixForm, bank_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={pixForm.pix_key_type}
                  onValueChange={(v) => setPixForm({ ...pixForm, pix_key_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="random">Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Chave</Label>
                <Input
                  value={pixForm.pix_key}
                  onChange={(e) => setPixForm({ ...pixForm, pix_key: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Nome do recebedor</Label>
              <Input
                maxLength={25}
                value={pixForm.merchant_name}
                onChange={(e) => setPixForm({ ...pixForm, merchant_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input
                maxLength={15}
                placeholder="Ex: SAO PAULO"
                value={pixForm.merchant_city}
                onChange={(e) => setPixForm({ ...pixForm, merchant_city: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              {editingPix && (
                <Button variant="ghost" className="flex-1" onClick={() => { setEditingPix(null); setPixForm(emptyPixForm); }}>
                  Cancelar
                </Button>
              )}
              <Button className="flex-1" onClick={savePixAccount}>
                {editingPix ? "Atualizar" : "Adicionar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
