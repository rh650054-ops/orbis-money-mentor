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
  X,
  Copy,
  Check,
  Settings,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { generatePixPayload } from "@/lib/pixCode";

interface Product {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  cost: number;
  sale_price: number;
  stock_quantity: number;
  stock_min: number;
}

interface PixProfile {
  pix_key: string | null;
  pix_key_type: string | null;
  pix_merchant_name: string | null;
  pix_merchant_city: string | null;
  nickname: string | null;
}

const emptyForm = {
  name: "",
  description: "",
  cost: "",
  sale_price: "",
  stock_quantity: "",
  stock_min: "",
  photo_url: "",
};

export default function Products() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [pixProfile, setPixProfile] = useState<PixProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // QR modal
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [copied, setCopied] = useState(false);

  // Pix config modal
  const [pixOpen, setPixOpen] = useState(false);
  const [pixForm, setPixForm] = useState({
    pix_key: "",
    pix_key_type: "cpf",
    pix_merchant_name: "",
    pix_merchant_city: "",
  });

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const [prodRes, profRes] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("pix_key, pix_key_type, pix_merchant_name, pix_merchant_city, nickname")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    if (prodRes.data) setProducts(prodRes.data as Product[]);
    if (profRes.data) {
      setPixProfile(profRes.data as PixProfile);
      setPixForm({
        pix_key: profRes.data.pix_key || "",
        pix_key_type: profRes.data.pix_key_type || "cpf",
        pix_merchant_name: profRes.data.pix_merchant_name || profRes.data.nickname || "",
        pix_merchant_city: profRes.data.pix_merchant_city || "",
      });
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
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
      sale_price: parseFloat(form.sale_price) || 0,
      stock_quantity: parseInt(form.stock_quantity) || 0,
      stock_min: parseInt(form.stock_min) || 0,
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

  const savePixConfig = async () => {
    if (!user) return;
    if (!pixForm.pix_key.trim() || !pixForm.pix_merchant_name.trim() || !pixForm.pix_merchant_city.trim()) {
      toast({ title: "Preencha todos os campos do Pix", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        pix_key: pixForm.pix_key.trim(),
        pix_key_type: pixForm.pix_key_type,
        pix_merchant_name: pixForm.pix_merchant_name.trim(),
        pix_merchant_city: pixForm.pix_merchant_city.trim(),
      })
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Pix configurado!" });
      setPixOpen(false);
      loadAll();
    }
  };

  const pixPayload = (p: Product) => {
    if (!pixProfile?.pix_key) return "";
    return generatePixPayload({
      pixKey: pixProfile.pix_key,
      amount: p.sale_price,
      merchantName: pixProfile.pix_merchant_name || pixProfile.nickname || "Vendedor",
      merchantCity: pixProfile.pix_merchant_city || "BRASIL",
      txid: p.id.slice(0, 8),
    });
  };

  const copyPayload = async () => {
    if (!qrProduct) return;
    await navigator.clipboard.writeText(pixPayload(qrProduct));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Stats
  const lowStock = products.filter((p) => p.stock_quantity <= p.stock_min);
  const totalStockValue = products.reduce((s, p) => s + p.cost * p.stock_quantity, 0);

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-2xl mx-auto px-4">
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold gradient-text truncate">Produtos & Estoque</h1>
            <p className="text-xs text-muted-foreground">Catálogo com QR Pix por produto</p>
          </div>
        </div>
        <Button size="icon" variant="outline" onClick={() => setPixOpen(true)} title="Configurar Pix">
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {!pixProfile?.pix_key && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Configure seu Pix</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Cadastre sua chave para gerar QR Code de pagamento em cada produto.
              </p>
              <Button size="sm" variant="outline" className="mt-2 h-8" onClick={() => setPixOpen(true)}>
                Configurar agora
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
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-base font-bold text-primary">
                            {formatCurrency(p.sale_price)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            custo {formatCurrency(p.cost)} • {marginPct.toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Estoque:{" "}
                          <span
                            className={
                              p.stock_quantity <= p.stock_min ? "text-warning font-semibold" : "font-semibold"
                            }
                          >
                            {p.stock_quantity}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setQrProduct(p)}
                        disabled={!pixProfile?.pix_key}
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

      {/* FORM MODAL */}
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
                <Label>Venda (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.sale_price}
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
          {qrProduct && pixProfile?.pix_key && (
            <div className="space-y-4 text-center">
              <div className="bg-white p-4 rounded-xl mx-auto inline-block">
                <QRCodeSVG value={pixPayload(qrProduct)} size={220} level="M" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor a receber</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(qrProduct.sale_price)}</p>
              </div>
              <Button onClick={copyPayload} variant="outline" className="w-full">
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copiado!" : "Copiar Pix Copia e Cola"}
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Pix de {pixProfile.pix_merchant_name} • {pixProfile.pix_merchant_city}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PIX CONFIG MODAL */}
      <Dialog open={pixOpen} onOpenChange={setPixOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Pix</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo de chave</Label>
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
                  <SelectItem value="random">Chave aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chave Pix</Label>
              <Input
                value={pixForm.pix_key}
                onChange={(e) => setPixForm({ ...pixForm, pix_key: e.target.value })}
                placeholder="Ex: 12345678900"
              />
            </div>
            <div>
              <Label>Nome do recebedor</Label>
              <Input
                value={pixForm.pix_merchant_name}
                onChange={(e) => setPixForm({ ...pixForm, pix_merchant_name: e.target.value })}
                placeholder="Como aparecerá no app do pagador"
                maxLength={25}
              />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input
                value={pixForm.pix_merchant_city}
                onChange={(e) => setPixForm({ ...pixForm, pix_merchant_city: e.target.value })}
                placeholder="Ex: SAO PAULO"
                maxLength={15}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPixOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={savePixConfig}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
