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
  ShoppingCart,
  ChefHat,
  Calculator,
} from "lucide-react";
import IngredientsManager from "@/components/products/IngredientsManager";
import RecipeEditor, { type RecipeItem } from "@/components/products/RecipeEditor";
import ProductActionsModal from "@/components/products/ProductActionsModal";
import { useIngredients } from "@/hooks/useIngredients";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { emitMissionEvent } from "@/shared/lib/missionEvents";
import { Input } from "@/shared/ui/input";
import { MoneyInput } from "@/shared/ui/money-input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Switch } from "@/shared/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";
import { generatePixPayload } from "@/shared/lib/pix-code";
import { BRAZILIAN_BANKS, getBankById } from "@/shared/lib/brazilian-banks";
import CalculadoraPreco from "@/components/estudio/CalculadoraPreco";
import FirstTimeCard from "@/components/FirstTimeCard";

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
  recipe_mode?: "none" | "per_unit" | "batch";
  batch_yield?: number;
  low_stock_alerts_enabled?: boolean;
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
  recipe_mode: "none" as "none" | "per_unit" | "batch",
  batch_yield: 0,
  recipe_items: [] as RecipeItem[],
  low_stock_alerts_enabled: true,
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
  const [connectedBankNames, setConnectedBankNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Product form
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionsProduct, setActionsProduct] = useState<Product | null>(null);
  const { lowStock: lowStockIngredients } = useIngredients();

  // QR modal
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [copied, setCopied] = useState(false);

  // Pix accounts manager
  const [pixManagerOpen, setPixManagerOpen] = useState(false);
  const [editingPix, setEditingPix] = useState<PixAccount | null>(null);
  const [pixForm, setPixForm] = useState(emptyPixForm);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [profileDefaults, setProfileDefaults] = useState({ name: "", city: "" });
  const [calcOpen, setCalcOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const [prodRes, pixRes, profRes, bankConnRes] = await Promise.all([
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
      Promise.resolve({ data: [] as { institution_name: string }[] }),
    ]);
    if (prodRes.data) setProducts(prodRes.data as Product[]);
    if (pixRes.data) setPixAccounts(pixRes.data as PixAccount[]);
    if (profRes.data) setProfileDefaults({
      name: profRes.data.nickname || "",
      city: (profRes.data.city || "").toUpperCase(),
    });
    if (bankConnRes.data) {
      setConnectedBankNames(
        (bankConnRes.data as { institution_name: string }[]).map((b) => b.institution_name),
      );
    }
    setLoading(false);
  };

  // Filtra os bancos disponíveis no seletor pelos que o usuário conectou em /bank-connections.
  // Match flexível por substring case-insensitive (ex: "Nu Pagamentos S.A." → Nubank).
  const availableBanks = (() => {
    if (connectedBankNames.length === 0) return [] as typeof BRAZILIAN_BANKS;
    const normalized = connectedBankNames.map((n) => n.toLowerCase());
    const matched = BRAZILIAN_BANKS.filter((b) => {
      const bn = b.name.toLowerCase();
      return normalized.some((n) => n.includes(bn) || bn.includes(n));
    });
    // Sempre permite "Outro banco" como fallback manual
    const outro = BRAZILIAN_BANKS.find((b) => b.id === "outro");
    if (outro && !matched.includes(outro)) matched.push(outro);
    return matched;
  })();

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
      recipe_mode: (p.recipe_mode ?? "none") as "none" | "per_unit" | "batch",
      batch_yield: Number(p.batch_yield ?? 0),
      recipe_items: [],
      low_stock_alerts_enabled: p.low_stock_alerts_enabled ?? true,
    });
    setFormOpen(true);
    // Carrega a receita já existente desse produto pra dentro do form (controlado).
    supabase
      .from("product_recipes")
      .select("id, ingredient_id, quantity")
      .eq("product_id", p.id)
      .then(({ data }) => {
        if (data) {
          setForm((f) => ({
            ...f,
            recipe_items: data.map((r) => ({ id: r.id, ingredient_id: r.ingredient_id, quantity: String(r.quantity) })),
          }));
        }
      });
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
      recipe_mode: form.recipe_mode,
      batch_yield: form.batch_yield || 0,
      low_stock_alerts_enabled: form.low_stock_alerts_enabled,
    };
    const { data: saved, error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id).select().single()
      : await supabase.from("products").insert(payload).select().single();
    if (saved && !editing) {
      // mantém o produto recém-criado em "editing" pra permitir adicionar receita logo em seguida
      setEditing(saved as Product);
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      // Grava a receita junto com o produto (controlada pelo form): apaga a antiga e regrava a atual.
      const pid = (saved as any)?.id ?? editing?.id;
      if (pid) {
        await supabase.from("product_recipes").delete().eq("product_id", pid);
        if (form.recipe_mode !== "none") {
          const rows = form.recipe_items
            .filter((r) => r.ingredient_id && r.quantity)
            .map((r) => ({
              user_id: user.id,
              product_id: pid,
              ingredient_id: r.ingredient_id,
              quantity: parseFloat(r.quantity) || 0,
            }));
          if (rows.length) await supabase.from("product_recipes").insert(rows);
        }
      }
      toast({ title: editing ? "Produto atualizado" : "Produto criado" });
      if (!editing) emitMissionEvent("product-added");
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
  const resetPixForm = () => {
    setEditingPix(null);
    setSelectedBankId(null);
    setPixForm({
      ...emptyPixForm,
      merchant_name: profileDefaults.name,
      merchant_city: profileDefaults.city,
    });
  };

  const openPixManager = () => {
    resetPixForm();
    setPixManagerOpen(true);
  };

  const selectBankToAdd = (bankId: string) => {
    const bank = getBankById(bankId);
    setSelectedBankId(bankId);
    setEditingPix(null);
    setPixForm({
      bank_name: bank.name,
      pix_key: "",
      pix_key_type: "cpf",
      merchant_name: profileDefaults.name,
      merchant_city: profileDefaults.city,
    });
  };

  const editPixAccount = (a: PixAccount) => {
    setEditingPix(a);
    const matched = BRAZILIAN_BANKS.find((b) => b.name === a.bank_name);
    setSelectedBankId(matched?.id || "outro");
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
      toast({ title: "Preencha chave, nome e cidade", variant: "destructive" });
      return;
    }
    const payload = {
      user_id: user.id,
      bank_name: pixForm.bank_name.trim(),
      pix_key: pixForm.pix_key.trim(),
      pix_key_type: pixForm.pix_key_type,
      merchant_name: pixForm.merchant_name.trim(),
      merchant_city: pixForm.merchant_city.trim().toUpperCase(),
      is_default: editingPix?.is_default ?? pixAccounts.length === 0,
    };
    const { error } = editingPix
      ? await supabase.from("pix_accounts").update(payload).eq("id", editingPix.id)
      : await supabase.from("pix_accounts").insert(payload);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingPix ? "Conta atualizada" : "✅ Banco adicionado" });
      resetPixForm();
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
    if (editingPix?.id === id) resetPixForm();
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
    <div className="space-y-6 pb-4 md:pb-8 max-w-2xl mx-auto px-4">
      <FirstTimeCard tela="catalogo" userId={user?.id} />
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground tracking-tight truncate">Produtos & Estoque</h1>
            <p className="text-xs text-muted-foreground">
              {pixAccounts.length} conta{pixAccounts.length !== 1 ? "s" : ""} Pix • QR por produto
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => setCalcOpen(true)} title="Calculadora de preço">
            <Calculator className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={openPixManager} title="Contas Pix">
            <Landmark className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <CalculadoraPreco open={calcOpen} onOpenChange={setCalcOpen} />

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

      {lowStockIngredients.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-semibold">Mercadoria acabando</p>
              <p className="text-muted-foreground">{lowStockIngredients.map((i) => i.name).join(", ")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="ingredients">
            Mercadoria {lowStockIngredients.length > 0 && <span className="ml-1.5 text-warning">●</span>}
          </TabsTrigger>
          <TabsTrigger value="stock">
            Estoque {lowStock.length > 0 && <span className="ml-1.5 text-warning">●</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ingredients" className="mt-4">
          <IngredientsManager />
        </TabsContent>

        {/* PRODUTOS */}
        <TabsContent value="products" className="space-y-3 mt-4">
          <Button data-tour="add-product" onClick={openCreate} className="w-full" size="lg">
            <Plus className="w-4 h-4 mr-2" /> Novo produto
          </Button>

          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
          ) : products.length === 0 ? (
            <Card>
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
                          <img loading="lazy" src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
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
                              <span className="text-xs text-muted-foreground">
                                custo {formatCurrency(p.cost)} • {marginPct.toFixed(0)}%
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <p className="text-xs text-muted-foreground">
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
                            <span className="text-xs text-muted-foreground">
                              • {acc.bank_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => setActionsProduct(p)}
                      >
                        <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Vender
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openQr(p)}
                        disabled={hasNoPix}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteProduct(p.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    {p.recipe_mode && p.recipe_mode !== "none" && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <ChefHat className="w-3 h-3" />
                        Receita {p.recipe_mode === "per_unit" ? "por unidade" : `por lote (rende ${p.batch_yield ?? 0})`}
                      </div>
                    )}
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
                  <p className="text-xs text-muted-foreground">un</p>
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
          <div className="space-y-5">
            {/* ===== IDENTIFICAÇÃO ===== */}
            <div className="space-y-3">
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
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Foto do produto</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {uploading ? "Enviando..." : "Toque no quadrado pra adicionar (até 5MB)"}
                  </p>
                </div>
              </div>

              <div>
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Brigadeiro" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
            </div>

            {/* ===== PREÇO & ESTOQUE ===== */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Preço & estoque</span>
              </div>

              <Card className="bg-muted/30 border-border/50">
                <CardContent className="p-3 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <Label htmlFor="open-price" className="font-medium">Preço aberto</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
                  <MoneyInput
                    value={parseFloat(form.cost) || 0}
                    onChange={(n) => setForm({ ...form, cost: n ? String(n) : "" })}
                  />
                </div>
                <div>
                  <Label className={form.open_price ? "text-muted-foreground" : ""}>
                    Venda (R$)
                  </Label>
                  <MoneyInput
                    value={form.open_price ? 0 : (parseFloat(form.sale_price) || 0)}
                    disabled={form.open_price}
                    placeholder={form.open_price ? "—" : "0,00"}
                    onChange={(n) => setForm({ ...form, sale_price: n ? String(n) : "" })}
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
                  <Label>Estoque mínimo</Label>
                  <Input
                    type="number"
                    value={form.stock_min}
                    onChange={(e) => setForm({ ...form, stock_min: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* ===== COMO O ESTOQUE BAIXA (receita) ===== */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Como o estoque baixa</span>
              </div>
              <RecipeEditor
                recipeMode={form.recipe_mode}
                batchYield={form.batch_yield}
                items={form.recipe_items}
                onChangeMode={(m) => setForm({ ...form, recipe_mode: m })}
                onChangeBatchYield={(n) => setForm({ ...form, batch_yield: n })}
                onChangeItems={(items) => setForm({ ...form, recipe_items: items })}
              />
            </div>

            {/* Conta Pix */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Receber Pix em</span>
                </div>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={openPixManager}
                >
                  + Nova conta
                </button>
              </div>
              {pixAccounts.length === 0 ? (
                <button
                  type="button"
                  onClick={openPixManager}
                  className="w-full text-left text-xs text-muted-foreground bg-muted/40 hover:bg-muted/60 rounded-lg p-3 transition"
                >
                  Toque para escolher seu banco e gerar QR Code →
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {pixAccounts.map((a) => {
                    const bank = BRAZILIAN_BANKS.find((b) => b.name === a.bank_name) || getBankById("outro");
                    const selected = form.pix_account_id === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setForm({ ...form, pix_account_id: a.id })}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border transition active:scale-95 ${
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border/60 bg-muted/30 hover:bg-muted/60"
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                          style={{ backgroundColor: `${bank.color}30` }}
                        >
                          {bank.emoji}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-xs font-medium truncate">{a.bank_name}</p>
                          {a.is_default && (
                            <p className="text-xs text-primary">★ Padrão</p>
                          )}
                        </div>
                        {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
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
                      <p className="text-xs text-muted-foreground">
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
      <Dialog open={pixManagerOpen} onOpenChange={(o) => { setPixManagerOpen(o); if (!o) resetPixForm(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contas Pix</DialogTitle>
          </DialogHeader>

          {/* Lista de contas já cadastradas */}
          {pixAccounts.length > 0 && !selectedBankId && !editingPix && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">
                Bancos cadastrados
              </p>
              {pixAccounts.map((a) => {
                const bank = BRAZILIAN_BANKS.find((b) => b.name === a.bank_name) || getBankById("outro");
                return (
                  <Card key={a.id} className={a.is_default ? "border-primary/50" : ""}>
                    <CardContent className="p-3 flex items-center gap-2">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                        style={{ backgroundColor: `${bank.color}25` }}
                      >
                        {bank.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm truncate">{a.bank_name}</p>
                          {a.is_default && <Star className="w-3 h-3 text-primary fill-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {a.pix_key_type.toUpperCase()} • {a.pix_key}
                        </p>
                      </div>
                      {!a.is_default && (
                        <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => setDefaultPix(a.id)} title="Tornar padrão">
                          <Star className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => editPixAccount(a)} aria-label="Editar Pix">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => deletePixAccount(a.id)} aria-label="Excluir Pix">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Seletor visual de banco — só mostra os bancos conectados em /bank-connections */}
          {!selectedBankId && !editingPix && (
            <div className="space-y-2 pt-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">
                {pixAccounts.length > 0 ? "Adicionar outro banco" : "Escolha seu banco"}
              </p>

              {availableBanks.length === 0 ? (
                <Card className="border-dashed border-primary/30 bg-primary/5">
                  <CardContent className="p-4 text-center space-y-3">
                    <Landmark className="w-8 h-8 mx-auto text-primary/70" />
                    <div>
                      <p className="text-sm font-medium">Nenhum banco conectado ainda</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Conecte seus bancos primeiro para gerar QR Codes Pix dos seus produtos.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setPixManagerOpen(false);
                        navigate("/bank-connections");
                      }}
                      className="gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Conectar banco
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableBanks.map((b) => {
                    const alreadyAdded = pixAccounts.some((a) => a.bank_name === b.name);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => selectBankToAdd(b.id)}
                        className="relative flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/60 hover:border-primary/50 transition active:scale-95"
                        style={alreadyAdded ? { opacity: 0.5 } : {}}
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                          style={{ backgroundColor: `${b.color}30` }}
                        >
                          {b.emoji}
                        </div>
                        <span className="text-xs font-medium text-center leading-tight line-clamp-2">
                          {b.name}
                        </span>
                        {alreadyAdded && (
                          <Check className="absolute top-1 right-1 w-3 h-3 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Form de chave Pix (só aparece após escolher banco) */}
          {(selectedBankId || editingPix) && (
            <div className="space-y-3 pt-2 border-t border-border/40">
              <div className="flex items-center gap-2">
                {(() => {
                  const bank = getBankById(selectedBankId || "outro");
                  return (
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: `${bank.color}30` }}
                    >
                      {bank.emoji}
                    </div>
                  );
                })()}
                <div className="flex-1">
                  <p className="font-semibold">{pixForm.bank_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {editingPix ? "Editando chave Pix" : "Adicionar chave Pix deste banco"}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-11 w-11" onClick={resetPixForm} aria-label="Fechar">
                  ✕
                </Button>
              </div>

              {selectedBankId === "outro" && !editingPix && (
                <div>
                  <Label>Nome do banco</Label>
                  <Input
                    placeholder="Ex: Banco Original"
                    value={pixForm.bank_name}
                    onChange={(e) => setPixForm({ ...pixForm, bank_name: e.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-[110px_1fr] gap-2">
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
                  <Label>Chave Pix</Label>
                  <Input
                    autoFocus
                    placeholder="Sua chave deste banco"
                    value={pixForm.pix_key}
                    onChange={(e) => setPixForm({ ...pixForm, pix_key: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
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
                    placeholder="SAO PAULO"
                    value={pixForm.merchant_city}
                    onChange={(e) => setPixForm({ ...pixForm, merchant_city: e.target.value })}
                  />
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={savePixAccount}>
                {editingPix ? "Atualizar banco" : "Salvar banco"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ProductActionsModal
        product={actionsProduct}
        onClose={() => setActionsProduct(null)}
        onChanged={loadAll}
      />
    </div>
  );
}
