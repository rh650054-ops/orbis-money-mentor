/* ============================================================
   CARGA DO DIA — v2 premium (Rick, 05/09).
   Entra ENTRE o "Modo Desafio" e o DEFCON rodando.
     • Hero: "se vender tudo entra R$X", custo da carga, meta do dia e
       com quantas unidades a meta bate.
     • Cada produto: quantidade (− / +), custo, ontem vendeu N de M,
       e os PREÇOS editáveis aqui mesmo: 1 unidade (products.sale_price)
       e combos (product_price_tiers: 2 un, 3 un…). É essa faixa que faz
       a venda de R$25 no DEFCON descontar 2 unidades e contar 1 venda.
     • Card verde: o que aconteceu ontem com a carga (zerou / sobrou).
   "hoje eu não controlo estoque" → começa do mesmo jeito, sem carga.
   Todo hook fica ACIMA do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Box, Loader2, Minus, Package, Play, Plus, TrendingUp, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDefconLoadout, type ProductOption } from "@/hooks/useDefconLoadout";
import { getBrazilDateDaysAgo } from "@/shared/lib/date-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

const brl0 = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));
const brl2 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Tier = { qty: number; price: number };
type Ontem = { qty_initial: number; qty_sold: number };

/* ---------- campo de preço: digita só números, os 2 últimos viram centavos ---------- */
function PrecoBox({ rotulo, valor, destaque, onCommit, onRemover, autoFocus }: {
  rotulo: string; valor: number; destaque?: boolean; onCommit: (n: number) => void; onRemover?: () => void; autoFocus?: boolean;
}) {
  const [texto, setTexto] = useState(valor > 0 ? brl2(valor) : "");
  const [foco, setFoco] = useState(false);
  if (!foco && valor > 0 && texto !== brl2(valor)) setTexto(brl2(valor));
  const num = () => { const d = texto.replace(/\D/g, ""); return d ? parseInt(d, 10) / 100 : 0; };
  return (
    <div className="flex-1 min-w-0 rounded-[13px] border px-2.5 pt-2 pb-2 relative"
      style={{ borderColor: destaque ? "rgba(245,184,0,.32)" : "rgba(255,255,255,.10)", background: destaque ? "rgba(245,184,0,.06)" : "rgba(0,0,0,.35)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-bold uppercase tracking-[.1em]" style={{ color: destaque ? "var(--orbis-gold)" : "var(--orbis-fg-3)" }}>{rotulo}</span>
        {onRemover && (
          <button type="button" onClick={onRemover} aria-label="Tirar esse preço" className="-mr-1 -mt-1 p-1" style={{ color: "var(--orbis-fg-3)" }}><X className="w-3 h-3" /></button>
        )}
      </div>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className="text-[11px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>R$</span>
        <input
          type="text" inputMode="numeric" value={texto} placeholder="0,00" autoFocus={autoFocus}
          onFocus={() => setFoco(true)}
          onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setTexto(d ? brl2(parseInt(d, 10) / 100) : ""); }}
          onBlur={() => { setFoco(false); onCommit(num()); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-full bg-transparent outline-none text-[17px] font-extrabold tabular-nums"
          aria-label={rotulo}
        />
      </div>
    </div>
  );
}

/* ---------- stepper de quantidade (persiste no blur / no toque) ---------- */
function Stepper({ valor, onCommit }: { valor: number; onCommit: (q: number) => void }) {
  const [texto, setTexto] = useState(String(valor));
  const [foco, setFoco] = useState(false);
  if (!foco && texto !== String(valor)) setTexto(String(valor));
  const commit = (n: number) => { if (Number.isFinite(n) && n >= 1 && n !== valor) onCommit(n); else setTexto(String(valor)); };
  return (
    <div className="flex items-center h-[42px] rounded-[13px] border overflow-hidden shrink-0" style={{ borderColor: "rgba(255,255,255,.12)" }}>
      <button type="button" onClick={() => commit(valor - 1)} className="w-[38px] h-full flex items-center justify-center active:bg-white/10" aria-label="Menos" style={{ color: "var(--orbis-fg-2)" }}><Minus className="w-4 h-4" /></button>
      <input type="number" inputMode="numeric" min={1} value={texto}
        onChange={(e) => setTexto(e.target.value)} onFocus={() => setFoco(true)}
        onBlur={() => { setFoco(false); commit(parseInt(texto, 10)); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="w-[46px] h-full bg-transparent text-center text-[17px] font-extrabold outline-none border-x tabular-nums" style={{ borderColor: "rgba(255,255,255,.10)" }} aria-label="Quantidade" />
      <button type="button" onClick={() => commit(valor + 1)} className="w-[38px] h-full flex items-center justify-center active:bg-white/10" aria-label="Mais" style={{ color: "var(--orbis-fg-2)" }}><Plus className="w-4 h-4" /></button>
    </div>
  );
}

function LinhaEscolher({ p, onLevar }: { p: ProductOption; onLevar: (q: number) => Promise<void> }) {
  const [q, setQ] = useState("");
  const [indo, setIndo] = useState(false);
  const n = parseInt(q, 10) || 0;
  return (
    <div className="flex items-center gap-2 rounded-[14px] border px-3 py-2" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold truncate">{p.name}</p>
        <p className="text-[11.5px]" style={{ color: "var(--orbis-fg-3)" }}>{Number(p.sale_price) > 0 ? `R$ ${brl2(Number(p.sale_price))} · ` : ""}estoque {p.stock_quantity}</p>
      </div>
      <input type="number" inputMode="numeric" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qtd"
        className="w-14 h-11 rounded-lg text-center text-sm font-bold bg-transparent border outline-none" style={{ borderColor: "rgba(255,255,255,.14)" }} aria-label="Quantidade" />
      <button type="button" disabled={n <= 0 || indo} onClick={async () => { setIndo(true); try { await onLevar(n); } finally { setIndo(false); } }}
        className="h-11 px-3 rounded-lg text-[12px] font-extrabold disabled:opacity-40" style={{ background: "var(--orbis-gold)", color: "#1A1200" }}>Levar</button>
    </div>
  );
}

export function DefconCargaDoDia({ userId, dailyGoal = 0, onComecar, starting }: { userId: string; dailyGoal?: number; onComecar: () => void; starting?: boolean }) {
  const { loadout, products, loading, addProduct, updateQty } = useDefconLoadout(userId);
  const [tiers, setTiers] = useState<Record<string, Tier[]>>({});
  const [precoLocal, setPrecoLocal] = useState<Record<string, number>>({});
  const [ontem, setOntem] = useState<Record<string, Ontem>>({});
  const [novoTier, setNovoTier] = useState<Record<string, number | undefined>>({});
  const [escolher, setEscolher] = useState(false);

  // faixas de preço + carga de ontem (uma vez)
  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    (async () => {
      const [{ data: t }, { data: o }] = await Promise.all([
        supabase.from("product_price_tiers" as any).select("product_id, qty, price").eq("user_id", userId).order("qty"),
        supabase.from("defcon_daily_loadout").select("product_id, qty_initial, qty_sold").eq("user_id", userId).eq("date", getBrazilDateDaysAgo(1)),
      ]);
      if (!vivo) return;
      const mapa: Record<string, Tier[]> = {};
      for (const r of (t as any[]) ?? []) (mapa[r.product_id] ??= []).push({ qty: Number(r.qty), price: Number(r.price) });
      setTiers(mapa);
      const mo: Record<string, Ontem> = {};
      for (const r of (o as any[]) ?? []) mo[r.product_id] = { qty_initial: Number(r.qty_initial) || 0, qty_sold: Number(r.qty_sold) || 0 };
      setOntem(mo);
    })();
    return () => { vivo = false; };
  }, [userId]);

  const precoDe = useCallback((p: ProductOption | undefined) => (p ? (precoLocal[p.id] ?? Number(p.sale_price) ?? 0) : 0), [precoLocal]);

  const salvarPreco1 = useCallback(async (pid: string, n: number) => {
    if (n <= 0) return;
    setPrecoLocal((m) => ({ ...m, [pid]: n }));
    await supabase.from("products").update({ sale_price: n }).eq("id", pid).eq("user_id", userId);
  }, [userId]);

  const salvarTier = useCallback(async (pid: string, qty: number, price: number) => {
    setNovoTier((m) => ({ ...m, [pid]: undefined }));
    if (price <= 0) return;
    setTiers((m) => {
      const lista = (m[pid] ?? []).filter((x) => x.qty !== qty).concat({ qty, price }).sort((a, b) => a.qty - b.qty);
      return { ...m, [pid]: lista };
    });
    await supabase.from("product_price_tiers" as any).upsert({ user_id: userId, product_id: pid, qty, price }, { onConflict: "product_id,qty" });
  }, [userId]);

  const removerTier = useCallback(async (pid: string, qty: number) => {
    setTiers((m) => ({ ...m, [pid]: (m[pid] ?? []).filter((x) => x.qty !== qty) }));
    await supabase.from("product_price_tiers" as any).delete().eq("product_id", pid).eq("qty", qty);
  }, []);

  // resumo da carga
  const resumo = useMemo(() => {
    let itens = 0, custo = 0, potencial = 0;
    for (const l of loadout) {
      const p = products.find((x) => x.id === l.product_id);
      const q = Number(l.qty_initial) || 0;
      itens += q;
      custo += q * (Number(p?.cost) || 0);
      potencial += q * precoDe(p);
    }
    const sobra = potencial - custo;
    const precoMedio = itens > 0 ? potencial / itens : 0;
    const unidadesMeta = dailyGoal > 0 && precoMedio > 0 ? Math.ceil(dailyGoal / precoMedio) : 0;
    const pctMeta = potencial > 0 && dailyGoal > 0 ? Math.min(100, Math.round((dailyGoal / potencial) * 100)) : 0;
    const bateMeta = dailyGoal > 0 && potencial >= dailyGoal;
    return { itens, custo, potencial, sobra, unidadesMeta, pctMeta, bateMeta };
  }, [loadout, products, precoDe, dailyGoal]);

  // card verde: o que ontem contou
  const frase = useMemo(() => {
    const zerou: string[] = [], sobrou: string[] = [];
    for (const l of loadout) {
      const o = ontem[l.product_id];
      if (!o || o.qty_initial <= 0) continue;
      const resto = o.qty_initial - o.qty_sold;
      if (resto <= 0) zerou.push(l.product_name.toLowerCase());
      else sobrou.push(`${resto} ${l.product_name.toLowerCase()}`);
    }
    if (!zerou.length && !sobrou.length) return null;
    const a = zerou.length ? `zerou ${zerou.join(" e ")}` : "";
    const b = sobrou.length ? `sobrou ${sobrou.join(" e ")}` : "";
    return `Ontem você ${[a, b].filter(Boolean).join(" e ")}.`;
  }, [loadout, ontem]);

  const disponiveis = products.filter((p) => !loadout.some((l) => l.product_id === p.id));

  return (
    <div className="min-h-[100dvh] bg-background pt-safe pb-safe px-5 pt-4 pb-10 max-w-md mx-auto orbis-stagger">
      <p className="orbis-mini">Antes de começar</p>
      <h1 className="font-display text-[24px] font-extrabold leading-[1.2] mt-1.5 tracking-tight">Sua mercadoria<br />de hoje.</h1>
      <p className="text-[12.5px] mt-2 leading-relaxed" style={{ color: "var(--orbis-fg-2)" }}>Tudo que sai daqui vira dinheiro no bolso. O Orbis desconta sozinho a cada venda e no fim te mostra o que sobrou.</p>

      {/* HERO */}
      {resumo.itens > 0 && (
        <div className="relative overflow-hidden rounded-[26px] border mt-4 px-5 pt-5 pb-[18px]"
          style={{ borderColor: "rgba(245,184,0,.30)", background: "radial-gradient(120% 90% at 50% -10%, rgba(245,184,0,.18), transparent 60%), linear-gradient(170deg,#1a1408 0%,#0c0c0c 70%)" }}>
          <div className="absolute right-[18px] top-[18px] w-14 h-14 rounded-[18px] flex items-center justify-center" style={{ background: "rgba(245,184,0,.12)", border: "1px solid rgba(245,184,0,.25)" }}>
            <Box className="w-6 h-6" style={{ color: "var(--orbis-gold)" }} strokeWidth={2} />
          </div>
          <p className="text-[10.5px] font-bold uppercase tracking-[.16em]" style={{ color: "var(--orbis-gold)" }}>Se vender tudo</p>
          <p className="text-[40px] font-extrabold leading-none mt-2 tracking-[-1px] tabular-nums">{brl0(resumo.potencial)}</p>
          <p className="text-[12.5px] mt-2 leading-relaxed" style={{ color: "var(--orbis-fg-2)" }}>
            {resumo.custo > 0
              ? <>Você investiu <b className="text-foreground">{brl0(resumo.custo)}</b> nessa carga. Vendendo tudo, sobram <b style={{ color: "#3DD68C" }}>{brl0(resumo.sobra)}</b> pra você.</>
              : <>Vendendo tudo, entra <b className="text-foreground">{brl0(resumo.potencial)}</b> — cadastre o custo do produto pra ver quanto sobra.</>}
          </p>
          <div className="flex mt-4 pt-3.5 border-t" style={{ borderColor: "rgba(255,255,255,.09)" }}>
            <div className="flex-1"><p className="text-[9.5px] font-bold uppercase tracking-[.08em]" style={{ color: "var(--orbis-fg-3)" }}>Levando</p><p className="text-[16px] font-bold mt-1 tabular-nums">{resumo.itens} un</p></div>
            <div className="flex-1 border-l pl-3" style={{ borderColor: "rgba(255,255,255,.09)" }}><p className="text-[9.5px] font-bold uppercase tracking-[.08em]" style={{ color: "var(--orbis-fg-3)" }}>Custo</p><p className="text-[16px] font-bold mt-1 tabular-nums" style={{ color: "#E5737F" }}>{brl0(resumo.custo)}</p></div>
            <div className="flex-1 border-l pl-3" style={{ borderColor: "rgba(255,255,255,.09)" }}><p className="text-[9.5px] font-bold uppercase tracking-[.08em]" style={{ color: "var(--orbis-fg-3)" }}>Meta do dia</p><p className="text-[16px] font-bold mt-1 tabular-nums" style={{ color: "var(--orbis-gold)" }}>{dailyGoal > 0 ? brl0(dailyGoal) : "—"}</p></div>
          </div>
          {dailyGoal > 0 && (
            <>
              <div className="h-1.5 rounded-full mt-3 overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
                <div className="h-full rounded-full" style={{ width: `${resumo.bateMeta ? resumo.pctMeta : 100}%`, background: resumo.bateMeta ? "linear-gradient(90deg,#F5B800,#FFC63A)" : "linear-gradient(90deg,#E5737F,#F2465A)" }} />
              </div>
              <div className="flex justify-between text-[11px] font-semibold mt-1.5" style={{ color: "var(--orbis-fg-3)" }}>
                {resumo.bateMeta
                  ? <><span>Meta bate com <b className="text-foreground">{resumo.unidadesMeta} unidades</b></span><span>{resumo.pctMeta}% da carga</span></>
                  : <span>Essa carga rende {brl0(resumo.potencial)} — abaixo da meta. Leva mais ou vende combo.</span>}
              </div>
            </>
          )}
        </div>
      )}

      <p className="orbis-mini mt-7">O que você vai levar</p>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--orbis-fg-3)" }} /></div>
      ) : products.length === 0 ? (
        <div className="rounded-[20px] border mt-3 p-5 text-center" style={{ borderColor: "rgba(245,184,0,.3)", background: "rgba(245,184,0,.05)" }}>
          <Package className="w-6 h-6 mx-auto" style={{ color: "var(--orbis-gold)" }} />
          <p className="text-[14.5px] font-semibold mt-3">Você ainda não cadastrou produto</p>
          <p className="text-[12.5px] mt-1.5" style={{ color: "var(--orbis-fg-3)" }}>Cadastra o que você vende e quanto custa — uma vez só. O preço você acerta aqui, todo dia.</p>
          <Link to="/products" className="orbis-cta w-full mt-4 inline-flex">CADASTRAR O QUE VOU LEVAR</Link>
        </div>
      ) : (
        <>
          {loadout.map((l) => {
            const p = products.find((x) => x.id === l.product_id);
            const preco1 = precoDe(p);
            const faixas = tiers[l.product_id] ?? [];
            const o = ontem[l.product_id];
            const combo2 = faixas.find((f) => f.qty === 2);
            const proximaQtd = (faixas.length ? Math.max(...faixas.map((f) => f.qty)) : 1) + 1;
            const abrindo = novoTier[l.product_id];
            return (
              <div key={l.id} className="rounded-[20px] border mt-2.5 px-3.5 pt-3.5 pb-3" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
                <div className="flex items-center gap-3">
                  <span className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.06)", color: "var(--orbis-fg-2)" }}><Package className="w-[18px] h-[18px]" strokeWidth={2} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold truncate">{l.product_name}</p>
                    <p className="text-[11.5px] font-semibold mt-0.5 truncate" style={{ color: "var(--orbis-fg-3)" }}>
                      {Number(p?.cost) > 0 ? `Custa R$ ${brl2(Number(p!.cost))} cada` : "Sem custo cadastrado"}
                      {o && o.qty_initial > 0 ? ` · ontem vendeu ${o.qty_sold} de ${o.qty_initial}` : ""}
                    </p>
                  </div>
                  <Stepper valor={Number(l.qty_initial)} onCommit={(q) => updateQty(l.id, q)} />
                </div>

                <div className="flex gap-2 mt-3">
                  <PrecoBox rotulo="1 unidade" valor={preco1} onCommit={(n) => salvarPreco1(l.product_id, n)} />
                  {faixas.map((f) => (
                    <PrecoBox key={f.qty} rotulo={`${f.qty} unidades`} valor={f.price} destaque onCommit={(n) => (n > 0 ? salvarTier(l.product_id, f.qty, n) : removerTier(l.product_id, f.qty))} onRemover={() => removerTier(l.product_id, f.qty)} />
                  ))}
                  {abrindo ? (
                    <PrecoBox rotulo={`${abrindo} unidades`} valor={0} destaque autoFocus onCommit={(n) => salvarTier(l.product_id, abrindo, n)} onRemover={() => setNovoTier((m) => ({ ...m, [l.product_id]: undefined }))} />
                  ) : faixas.length < 3 ? (
                    <button type="button" onClick={() => setNovoTier((m) => ({ ...m, [l.product_id]: proximaQtd }))}
                      className="rounded-[13px] border border-dashed px-2.5 text-[12px] font-bold shrink-0" style={{ borderColor: "rgba(245,184,0,.32)", color: "var(--orbis-gold)", flex: faixas.length ? ".55" : "1" }}>
                      {faixas.length ? `+ ${proximaQtd} un` : "+ preço de 2 un"}
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center justify-between mt-2.5">
                  <p className="text-[11.5px] leading-snug flex-1" style={{ color: "var(--orbis-fg-3)" }}>
                    {combo2
                      ? <>No DEFCON, a venda de <b style={{ color: "var(--orbis-fg-2)" }}>{brl0(combo2.price)}</b> já desconta <b style={{ color: "var(--orbis-fg-2)" }}>2 unidades</b> e conta como <b style={{ color: "var(--orbis-fg-2)" }}>1 venda</b>.</>
                      : <>Cadastre o preço de 2 un: no DEFCON a venda de combo desconta 2 e conta 1 venda.</>}
                  </p>
                  <button type="button" onClick={() => updateQty(l.id, 0)} className="text-[11px] font-semibold ml-3 shrink-0" style={{ color: "var(--orbis-fg-3)" }}>tirar</button>
                </div>
              </div>
            );
          })}

          {disponiveis.length > 0 && (
            <button type="button" onClick={() => setEscolher(true)} data-tour="loadout-add"
              className="w-full h-[46px] rounded-[14px] border border-dashed mt-2.5 flex items-center justify-center gap-2 text-[13.5px] font-bold active:scale-[.98]"
              style={{ borderColor: "rgba(245,184,0,.35)", color: "var(--orbis-gold)" }}>
              <Plus className="w-4 h-4" strokeWidth={2.5} /> {loadout.length ? "adicionar outro produto" : "escolher o que vou levar"}
            </button>
          )}
          {loadout.length === 0 && disponiveis.length === 0 && (
            <p className="text-[12.5px] mt-3 text-center" style={{ color: "var(--orbis-fg-3)" }}>Todos os produtos já estão na carga.</p>
          )}
        </>
      )}

      {/* ONTEM */}
      {resumo.itens > 0 && (
        <div className="rounded-[16px] border mt-5 px-[15px] py-[13px] flex items-center gap-3" style={{ borderColor: "rgba(61,214,140,.30)", background: "rgba(61,214,140,.07)" }}>
          <span className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0" style={{ background: "rgba(61,214,140,.15)", color: "#3DD68C" }}><TrendingUp className="w-[17px] h-[17px]" strokeWidth={2.2} /></span>
          <span className="flex-1 min-w-0">
            <b className="block text-[13.5px] font-bold leading-snug">{frase ?? "Primeira carga registrada."}</b>
            <small className="block text-[12px] mt-0.5 leading-snug" style={{ color: "var(--orbis-fg-2)" }}>
              {frase ? `Bora zerar — dá ${brl0(resumo.potencial)} na mão.` : `Tudo que vender hoje o Orbis desconta sozinho. Zerando, dá ${brl0(resumo.potencial)} na mão.`}
            </small>
          </span>
        </div>
      )}

      <button onClick={onComecar} disabled={starting}
        className="w-full h-[56px] rounded-[17px] mt-[18px] font-extrabold text-[16px] tracking-wide flex items-center justify-center gap-2 active:scale-[.98] transition"
        style={{ background: "linear-gradient(180deg,#F2465A,#E5354A)", color: "#FFF", boxShadow: "0 12px 28px -10px rgba(229,53,74,.9)" }}>
        {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Play className="w-[18px] h-[18px]" fill="#fff" strokeWidth={0} /> COMEÇAR O DIA</>}
      </button>
      <button onClick={onComecar} disabled={starting} className="w-full h-10 mt-1 text-[13px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>hoje eu não controlo estoque</button>

      <Dialog open={escolher} onOpenChange={setEscolher}>
        <DialogContent className="bg-card border-border max-w-md max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader><DialogTitle className="text-foreground">O que mais você vai levar?</DialogTitle></DialogHeader>
          <div className="space-y-2.5">
            {disponiveis.map((p) => (
              <LinhaEscolher key={p.id} p={p} onLevar={async (q) => { await addProduct(p, q); setEscolher(false); }} />
            ))}
            <Link to="/products" className="block text-center text-[12.5px] font-semibold pt-1" style={{ color: "var(--orbis-gold)" }}>cadastrar um produto novo</Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
