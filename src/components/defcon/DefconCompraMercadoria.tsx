import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/shared/lib/utils";
import { MoneyInput } from "@/shared/ui/money-input";
import { useToast } from "@/shared/hooks/use-toast";
import { ShoppingCart, Package, Beaker, Plus, X, TrendingDown, TrendingUp, Sparkles } from "lucide-react";

// Compra de mercadoria com custo automático.
// Modo "Total da compra": valor final gasto -> produto -> quantas unidades -> estoque + custo médio.
// Modo "Compra de insumos": item a item (qtd x valor unitário) -> estoque de insumos,
// com alerta de preço acima da média e produção opcional ("quantas unidades saem?").
// Backend: tabela compras_mercadoria (trigger faz estoque/custo/CMV) + RPC registrar_producao.

const sb = supabase as any;

interface Prod { id: string; name: string; cost: number; sale_price: number; stock_quantity: number }
interface Ing { id: string; name: string; unit: string; stock_quantity: number; cost_per_unit: number }
interface CartItem {
  itemId: string | null; nome: string; unidade: string; novo: boolean;
  qtd: number; valorUn: number; total: number; media: number | null;
  destinoId: string | null; destinoNome: string | null;
}

const UNIDADES = ["un", "kg", "g", "L", "ml", "cx", "dz", "pct"];
const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function DefconCompraMercadoria({ userId, onChanged }: { userId: string; onChanged?: () => void }) {
  const { toast } = useToast();
  const [modo, setModo] = useState<"total" | "insumos">("total");
  const [products, setProducts] = useState<Prod[]>([]);
  const [ings, setIngs] = useState<Ing[]>([]);
  const [saving, setSaving] = useState(false);

  // modo total
  const [tValor, setTValor] = useState(0);
  const [tProd, setTProd] = useState("");
  const [tUnidades, setTUnidades] = useState("");

  // modo insumos
  const [iNome, setINome] = useState("");
  const [iUnit, setIUnit] = useState("un");
  const [iQtd, setIQtd] = useState("");
  const [iValor, setIValor] = useState(0);
  const [iDestino, setIDestino] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; caro: boolean } | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [producaoQtde, setProducaoQtde] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const [{ data: prods }, { data: ii }] = await Promise.all([
      supabase.from("products").select("id, name, cost, sale_price, stock_quantity")
        .eq("user_id", userId).eq("is_active", true).order("name"),
      supabase.from("ingredients").select("id, name, unit, stock_quantity, cost_per_unit")
        .eq("user_id", userId).order("name"),
    ]);
    setProducts((prods as Prod[]) ?? []);
    setIngs((ii as Ing[]) ?? []);
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const ingAtual = useMemo(() => ings.find((i) => norm(i.name) === norm(iNome)) ?? null, [ings, iNome]);

  // Inteligência de preço: compara com a média das últimas 3 compras do insumo.
  useEffect(() => {
    let vivo = true;
    setAviso(null);
    const v = iValor;
    if (!ingAtual || !v || v <= 0) return;
    sb.from("compras_mercadoria").select("custo_unitario")
      .eq("ingredient_id", ingAtual.id).order("created_at", { ascending: false }).limit(3)
      .then(({ data }: { data: { custo_unitario: number }[] | null }) => {
        if (!vivo || !data?.length) return;
        const media = data.reduce((s, r) => s + Number(r.custo_unitario), 0) / data.length;
        const dif = ((v - media) / media) * 100;
        if (dif >= 3) setAviso({ caro: true, texto: `Você costuma pagar ${formatCurrency(media)} — está ${Math.round(dif)}% mais caro. Vale pechinchar.` });
        else if (dif <= -3) setAviso({ caro: false, texto: `Bom preço! ${Math.round(Math.abs(dif))}% mais barato que sua média (${formatCurrency(media)}).` });
      });
    return () => { vivo = false; };
  }, [ingAtual, iValor]);

  const grupos = useMemo(() => {
    const g = new Map<string, { nome: string; total: number; itens: CartItem[] }>();
    for (const it of cart) {
      if (!it.destinoId) continue;
      const cur = g.get(it.destinoId) ?? { nome: it.destinoNome ?? "", total: 0, itens: [] };
      cur.total += it.total; cur.itens.push(it);
      g.set(it.destinoId, cur);
    }
    return g;
  }, [cart]);

  const addItem = () => {
    const qtd = parseFloat(iQtd);
    if (!iNome.trim() || !qtd || qtd <= 0 || !iValor || iValor <= 0) {
      toast({ title: "Preencha o insumo, quantidade e valor por unidade", variant: "destructive" });
      return;
    }
    const destino = products.find((p) => p.id === iDestino) ?? null;
    setCart((c) => [...c, {
      itemId: ingAtual?.id ?? null, nome: ingAtual?.name ?? iNome.trim(),
      unidade: ingAtual?.unit || iUnit, novo: !ingAtual,
      qtd, valorUn: iValor, total: qtd * iValor, media: null,
      destinoId: destino?.id ?? null, destinoNome: destino?.name ?? null,
    }]);
    setINome(""); setIQtd(""); setIValor(0); setIDestino(""); setAviso(null);
  };

  const lancarTotal = async () => {
    const unidades = parseInt(tUnidades, 10);
    if (!tValor || tValor <= 0 || !tProd || !unidades || unidades <= 0) {
      toast({ title: "Preencha o valor, o produto e quantas unidades", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await sb.from("compras_mercadoria").insert({
        user_id: userId, item_tipo: "produto", product_id: tProd,
        quantidade: unidades, total_pago: tValor, lancar_custo_dia: true,
      }).select().single();
      if (error) throw error;
      toast({
        title: `Compra lançada — ${formatCurrency(Number(data.custo_unitario))} por unidade`,
        description: `+${unidades} no estoque · custo médio ${formatCurrency(Number(data.custo_novo))} · lançado como Mercadoria no relatório`,
      });
      setTValor(0); setTProd(""); setTUnidades("");
      await load(); onChanged?.();
    } catch (e) {
      console.warn("[compra] erro", e);
      toast({ title: "Erro ao lançar a compra", variant: "destructive" });
    }
    setSaving(false);
  };

  const lancarInsumos = async () => {
    for (const [pid, g] of grupos) {
      if (!(producaoQtde[pid] && producaoQtde[pid]! > 0)) {
        toast({ title: `Diga quantas unidades de ${g.nome} saem desses insumos`, variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    try {
      const comprados: CartItem[] = [];
      for (const it of cart) {
        let id = it.itemId;
        if (!id) {
          const { data: novo, error } = await supabase.from("ingredients")
            .insert({ user_id: userId, name: it.nome, unit: it.unidade }).select("id").single();
          if (error) throw error;
          id = (novo as { id: string }).id;
        }
        const { error: errC } = await sb.from("compras_mercadoria").insert({
          user_id: userId, item_tipo: "ingrediente", ingredient_id: id,
          quantidade: it.qtd, total_pago: it.total, lancar_custo_dia: true,
        });
        if (errC) throw errC;
        comprados.push({ ...it, itemId: id });
      }
      const frases: string[] = [];
      for (const [pid, g] of grupos) {
        const unidades = producaoQtde[pid]!;
        const insumos = comprados.filter((c) => c.destinoId === pid)
          .map((c) => ({ ingredient_id: c.itemId, quantidade: c.qtd }));
        const { data: prod, error } = await sb.rpc("registrar_producao", {
          p_product_id: pid, p_unidades: unidades, p_custo_total: g.total, p_insumos: insumos,
        });
        if (error) throw error;
        frases.push(`${g.nome}: ${unidades} un a ${formatCurrency(Number(prod.custo_unitario))}`);
      }
      const total = cart.reduce((s, c) => s + c.total, 0);
      toast({
        title: `${cart.length} ite${cart.length > 1 ? "ns" : "m"} · ${formatCurrency(total)} lançados`,
        description: frases.length ? frases.join(" · ") : "Estoque de insumos e relatório atualizados",
      });
      setCart([]); setProducaoQtde({});
      await load(); onChanged?.();
    } catch (e) {
      console.warn("[compra insumos] erro", e);
      toast({ title: "Erro ao lançar a compra", variant: "destructive" });
    }
    setSaving(false);
  };

  const previewTotal = (() => {
    const u = parseInt(tUnidades, 10);
    return tValor > 0 && u > 0 ? tValor / u : null;
  })();
  const cartTotal = cart.reduce((s, c) => s + c.total, 0);

  const inputCls = "w-full h-11 bg-background border border-border rounded-xl px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary placeholder:text-muted-foreground";

  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShoppingCart className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Compra de mercadoria</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Anota a compra uma vez — estoque, custo por produto e relatório se resolvem sozinhos.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {([
          { id: "total", label: "Total da compra", Icon: Package },
          { id: "insumos", label: "Compra de insumos", Icon: Beaker },
        ] as const).map(({ id, label, Icon }) => (
          <button key={id} type="button" onClick={() => setModo(id)}
            className={`flex items-center justify-center gap-1.5 h-11 rounded-xl border text-xs font-semibold transition active:scale-95 ${
              modo === id ? "border-primary bg-primary/10 text-foreground" : "border-border/60 bg-background text-muted-foreground"
            }`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {modo === "total" ? (
        <div className="space-y-2">
          <MoneyInput value={tValor} onChange={setTValor} placeholder="Valor final da compra (R$)" className={inputCls} />
          <select value={tProd} onChange={(e) => setTProd(e.target.value)} className={inputCls}>
            <option value="">Isso vira qual produto?</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="number" inputMode="numeric" min={1} value={tUnidades}
            onChange={(e) => setTUnidades(e.target.value)}
            placeholder="Quantas unidades você faz com essa compra?" className={inputCls} />
          {previewTotal !== null && (
            <p className="text-xs text-center text-primary font-semibold">
              <Sparkles className="w-3 h-3 inline mr-1" />
              Cada unidade vai te custar {formatCurrency(previewTotal)}
            </p>
          )}
          <button onClick={lancarTotal} disabled={saving}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-95">
            <Plus className="w-4 h-4" />Lançar compra
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input list="dl-insumos" value={iNome} onChange={(e) => setINome(e.target.value)}
            placeholder="Qual insumo? (ex: Leite condensado)" className={inputCls} />
          <datalist id="dl-insumos">{ings.map((i) => <option key={i.id} value={i.name} />)}</datalist>
          {iNome.trim() && !ingAtual && (
            <p className="text-xs text-primary"><Sparkles className="w-3 h-3 inline mr-1" />Insumo novo — será criado e salvo automaticamente.</p>
          )}
          <div className="grid grid-cols-3 gap-2">
            <input type="number" inputMode="decimal" min={0} value={iQtd} onChange={(e) => setIQtd(e.target.value)}
              placeholder={`Qtd${ingAtual?.unit ? ` (${ingAtual.unit})` : ""}`} className={inputCls} />
            <select value={ingAtual?.unit ?? iUnit} disabled={!!ingAtual} onChange={(e) => setIUnit(e.target.value)} className={inputCls}>
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <MoneyInput value={iValor} onChange={setIValor} placeholder="R$/un" className={inputCls} />
          </div>
          <select value={iDestino} onChange={(e) => setIDestino(e.target.value)} className={inputCls}>
            <option value="">Para qual produto? (opcional — só estoque)</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {aviso && (
            <p className={`text-xs font-semibold rounded-xl border px-3 py-2 ${aviso.caro ? "text-destructive border-destructive/40 bg-destructive/10" : "text-success border-success/40 bg-success/10"}`}>
              {aviso.caro ? <TrendingUp className="w-3 h-3 inline mr-1" /> : <TrendingDown className="w-3 h-3 inline mr-1" />}
              {aviso.texto}
            </p>
          )}
          <button onClick={addItem} className="w-full h-10 rounded-xl border border-primary/40 bg-primary/5 text-primary font-semibold text-xs flex items-center justify-center gap-1 active:scale-95">
            <Plus className="w-3.5 h-3.5" />Adicionar item
          </button>

          {cart.length > 0 && (
            <div className="space-y-1.5">
              {cart.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-xl bg-background border border-border px-3 py-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{it.nome}{it.novo ? " ✦" : ""}</p>
                    <p className="text-muted-foreground">
                      {it.qtd} {it.unidade} × {formatCurrency(it.valorUn)}{it.destinoNome ? ` → ${it.destinoNome}` : ""}
                    </p>
                  </div>
                  <span className="font-bold text-foreground">{formatCurrency(it.total)}</span>
                  <button onClick={() => setCart((c) => c.filter((_, i) => i !== idx))}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                </div>
              ))}
              {[...grupos.entries()].map(([pid, g]) => (
                <div key={pid} className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 space-y-1">
                  <p className="text-xs text-foreground">
                    Com {formatCurrency(g.total)} de insumos, quantas unidades de <b>{g.nome}</b> você faz?
                  </p>
                  <input type="number" inputMode="numeric" min={1} value={producaoQtde[pid] ?? ""}
                    onChange={(e) => setProducaoQtde((m) => ({ ...m, [pid]: parseInt(e.target.value, 10) || 0 }))}
                    placeholder="ex: 40" className={inputCls} />
                  {(producaoQtde[pid] ?? 0) > 0 && (
                    <p className="text-xs text-primary font-bold">→ {formatCurrency(g.total / producaoQtde[pid]!)} por unidade</p>
                  )}
                </div>
              ))}
              <button onClick={lancarInsumos} disabled={saving}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-40 active:scale-95">
                Lançar compra · {cart.length} ite{cart.length > 1 ? "ns" : "m"} · {formatCurrency(cartTotal)}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
