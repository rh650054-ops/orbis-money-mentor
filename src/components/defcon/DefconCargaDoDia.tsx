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
import { Loader2, Minus, Package, Play, Plus, TrendingUp, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { arrumarDinheiro, limparDinheiro, reaisDeTexto, textoDeReais } from "@/shared/lib/dinheiro";
import { useDefconLoadout, type ProductOption } from "@/hooks/useDefconLoadout";
import { getBrazilDateDaysAgo } from "@/shared/lib/date-utils";
import { AvisoEstoqueCarga } from "./aviso-estoque-carga";
import { CargaEscolher } from "./carga-escolher";
import { CargaResumo } from "./carga-resumo";

const brl0 = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));
const brl2 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Tier = { qty: number; price: number };
type Ontem = { qty_initial: number; qty_sold: number };

/* ---------- campo de preço: regra do app (12/10) — digitou "5" = R$ 5,00, a vírgula é dele ---------- */
/** "Batida" -> "Batidas", "Água" -> "Águas", "Pão" -> "Pães" nao: fica "Pães" fora
 *  do alcance. Regra simples de portugues que cobre quase todo produto de rua;
 *  quando erra, erra num plural feio, nunca num numero errado. */
function plural(nome: string) {
  const n = (nome || "").trim();
  if (!n) return n;
  const f = n.slice(-1).toLowerCase();
  if (n.toLowerCase().endsWith("ao")) return n.slice(0, -2) + "oes";
  if (n.toLowerCase().endsWith("\u00e3o")) return n.slice(0, -2) + "\u00f5es";
  if ("aeiou\u00e1\u00e9\u00ed\u00f3\u00fa\u00e2\u00ea\u00f4\u00e3\u00f5".includes(f)) return n + "s";
  if (f === "m") return n.slice(0, -1) + "ns";
  if (f === "r" || f === "z") return n + "es";
  if (f === "l") return n.slice(0, -1) + "is";
  if (f === "s") return n;
  return n + "s";
}

function PrecoBox({ rotulo, valor, destaque, onCommit, onRemover, autoFocus }: {
  rotulo: string; valor: number; destaque?: boolean; onCommit: (n: number) => void; onRemover?: () => void; autoFocus?: boolean;
}) {
  const [texto, setTexto] = useState(valor > 0 ? textoDeReais(valor) : "");
  const [foco, setFoco] = useState(false);
  if (!foco && valor > 0 && texto !== textoDeReais(valor)) setTexto(textoDeReais(valor));
  const num = () => reaisDeTexto(texto);
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
          type="text" inputMode="decimal" value={texto} placeholder="0" autoFocus={autoFocus}
          onFocus={() => setFoco(true)}
          onChange={(e) => setTexto(limparDinheiro(e.target.value))}
          onBlur={() => { setFoco(false); setTexto(arrumarDinheiro(texto)); onCommit(num()); }}
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

export function DefconCargaDoDia({ userId, dailyGoal = 0, onComecar, starting }: { userId: string; dailyGoal?: number; onComecar: () => void; starting?: boolean }) {
  const { loadout, products, loading, updateQty, levarVarios, aviso, confirmarAviso, levarSoOQueTem, fecharAviso } = useDefconLoadout(userId);
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

  const precoDe = useCallback((p: ProductOption | undefined) => (p ? (precoLocal[p.id] ?? (Number(p.sale_price) || 0)) : 0), [precoLocal]);

  const salvarPreco1 = useCallback(async (pid: string, n: number) => {
    if (n <= 0) return;
    setPrecoLocal((m) => ({ ...m, [pid]: n }));
    const { error } = await supabase.from("products").update({ sale_price: n }).eq("id", pid).eq("user_id", userId);
    if (error) avisar.usuario("Não consegui salvar o preço. Tenta de novo.", error, "DefconCargaDoDia: salvar preço");
  }, [userId]);

  const salvarTier = useCallback(async (pid: string, qty: number, price: number) => {
    setNovoTier((m) => ({ ...m, [pid]: undefined }));
    if (price <= 0) return;
    setTiers((m) => {
      const lista = (m[pid] ?? []).filter((x) => x.qty !== qty).concat({ qty, price }).sort((a, b) => a.qty - b.qty);
      return { ...m, [pid]: lista };
    });
    const { error } = await supabase.from("product_price_tiers" as any).upsert({ user_id: userId, product_id: pid, qty, price }, { onConflict: "product_id,qty" });
    if (error) avisar.usuario("Não consegui salvar o preço por quantidade. Tenta de novo.", error, "DefconCargaDoDia: salvar faixa");
  }, [userId]);

  const removerTier = useCallback(async (pid: string, qty: number) => {
    setTiers((m) => ({ ...m, [pid]: (m[pid] ?? []).filter((x) => x.qty !== qty) }));
    const { error } = await supabase.from("product_price_tiers" as any).delete().eq("product_id", pid).eq("qty", qty);
    if (error) avisar.usuario("Não consegui remover o preço por quantidade. Tenta de novo.", error, "DefconCargaDoDia: remover faixa");
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
    return { itens, custo, potencial, sobra, unidadesMeta, pctMeta, bateMeta, produtos: loadout.length };
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


  return (
    <div className="min-h-[100dvh] bg-background pt-safe pb-safe px-5 pt-5 pb-10 max-w-md mx-auto orbis-stagger">
      <p className="text-[10.5px] font-black uppercase tracking-[.18em]" style={{ color: "var(--orbis-gold)" }}>Antes de começar</p>
      <p className="font-display text-[26px] font-extrabold leading-tight tracking-tight mt-1">Carga do dia</p>
      <p className="text-[13px] mt-1" style={{ color: "var(--orbis-fg-2)" }}>O que você vai levar, quanto vale e se bate a meta.</p>

      <CargaResumo itens={resumo.itens} produtos={resumo.produtos} potencial={resumo.potencial} custo={resumo.custo} sobra={resumo.sobra}
        meta={dailyGoal} unidadesMeta={resumo.unidadesMeta} onEscolher={() => setEscolher(true)} />

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
          {loadout.length > 0 && (
            <div className="flex items-end justify-between mt-6">
              <div>
                <p className="text-[17px] font-extrabold tracking-tight">Na sua carga</p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>Os preços aparecem na hora da venda.</p>
              </div>
              <span className="text-[12px] font-bold" style={{ color: "var(--orbis-fg-3)" }}>{resumo.produtos} {resumo.produtos === 1 ? "produto" : "produtos"}</span>
            </div>
          )}
          {loadout.map((l) => {
            const p = products.find((x) => x.id === l.product_id);
            const preco1 = precoDe(p);
            const faixas = tiers[l.product_id] ?? [];
            const proximaQtd = (faixas.length ? Math.max(...faixas.map((f) => f.qty)) : 1) + 1;
            const abrindo = novoTier[l.product_id];
            return (
              <div key={l.id} className="rounded-[20px] border mt-2.5 px-4 pt-3.5 pb-3" style={{ borderColor: "rgba(255,255,255,.09)", background: "linear-gradient(180deg,#151515,#0f0f0f)" }}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[17px] font-extrabold truncate tracking-tight">{l.product_name}</p>
                    <p className="text-[12px] font-semibold mt-0.5 truncate" style={{ color: "var(--orbis-fg-3)" }}>
                      {Number(p?.cost) > 0 ? `custa R$ ${brl2(Number(p!.cost))} cada` : "sem custo cadastrado"}
                    </p>
                  </div>
                  <Stepper valor={Number(l.qty_initial)} onCommit={(q) => updateQty(l.id, q)} />
                </div>

                <div className="flex gap-2 mt-3">
                  <PrecoBox rotulo={`1 ${l.product_name}`} valor={preco1} onCommit={(n) => salvarPreco1(l.product_id, n)} />
                  {faixas.map((f) => (
                    <PrecoBox key={f.qty} rotulo={`${f.qty} ${plural(l.product_name)}`} valor={f.price} destaque onCommit={(n) => (n > 0 ? salvarTier(l.product_id, f.qty, n) : removerTier(l.product_id, f.qty))} onRemover={() => removerTier(l.product_id, f.qty)} />
                  ))}
                  {abrindo ? (
                    <PrecoBox rotulo={`${abrindo} ${plural(l.product_name)}`} valor={0} destaque autoFocus onCommit={(n) => salvarTier(l.product_id, abrindo, n)} onRemover={() => setNovoTier((m) => ({ ...m, [l.product_id]: undefined }))} />
                  ) : faixas.length < 3 ? (
                    <button type="button" onClick={() => setNovoTier((m) => ({ ...m, [l.product_id]: proximaQtd }))}
                      className="rounded-[13px] border border-dashed px-2.5 text-[12px] font-bold shrink-0" style={{ borderColor: "rgba(245,184,0,.32)", color: "var(--orbis-gold)", flex: faixas.length ? ".55" : "1" }}>
                      {faixas.length ? `+ ${proximaQtd}` : `+ combo`}
                    </button>
                  ) : null}
                </div>

                <div className="flex items-start justify-between gap-3 mt-2.5">
                  {/* the current DEFCON rule, said plainly (not changed): a combo sale takes N from stock, 1 sale */}
                  <p className="text-[11.5px] leading-snug" style={{ color: "var(--orbis-fg-3)" }}>
                    {faixas.length
                      ? <>Combo {faixas[0]!.qty} por R$ {brl2(faixas[0]!.price)}: no Foco, essa venda baixa <b style={{ color: "#d8d2c4" }}>{faixas[0]!.qty} do estoque</b> e conta como <b style={{ color: "#d8d2c4" }}>1 venda</b>.</>
                      : <>Tem combo (ex.: 2 por R$ 35)? Toque em "+ combo".</>}
                  </p>
                  <button type="button" onClick={() => updateQty(l.id, 0)} className="shrink-0 text-[12px] font-bold inline-flex items-center gap-1" style={{ color: "#E5737F" }}><X className="w-3.5 h-3.5" /> tirar</button>
                </div>
              </div>
            );
          })}

          <button type="button" onClick={() => setEscolher(true)} data-tour="loadout-add"
            className="w-full h-[54px] rounded-[16px] mt-3 flex items-center justify-center gap-2 text-[14.5px] font-extrabold active:scale-[.98]"
            style={{ border: "1px solid rgba(245,184,0,.55)", color: "var(--orbis-gold)", background: "linear-gradient(180deg,rgba(245,184,0,.10),rgba(245,184,0,.03))" }}>
            <Package className="w-[18px] h-[18px]" strokeWidth={2.4} /> {loadout.length ? "Adicionar ou mudar produtos" : "Escolher o que vou levar"}
          </button>
        </>
      )}

      {/* ONTEM */}
      {resumo.itens > 0 && frase && (
        <div className="rounded-[16px] border mt-4 px-[15px] py-[13px] flex items-center gap-3" style={{ borderColor: "rgba(61,214,140,.30)", background: "rgba(61,214,140,.07)" }}>
          <span className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0" style={{ background: "rgba(61,214,140,.15)", color: "#3DD68C" }}><TrendingUp className="w-[17px] h-[17px]" strokeWidth={2.2} /></span>
          <span className="flex-1 min-w-0">
            <b className="block text-[13.5px] font-bold leading-snug">{frase}</b>
            <small className="block text-[12px] mt-0.5 leading-snug" style={{ color: "var(--orbis-fg-2)" }}>Bora zerar — dá {brl0(resumo.potencial)} na mão.</small>
          </span>
        </div>
      )}

      <button onClick={onComecar} disabled={starting}
        className="w-full h-[58px] rounded-[18px] mt-6 font-extrabold text-[16.5px] tracking-wide flex items-center justify-center gap-2 active:scale-[.98] transition"
        style={{ background: "linear-gradient(180deg,#F2465A,#E5354A)", color: "#FFF", boxShadow: "0 14px 32px -10px rgba(229,53,74,.9)" }}>
        {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Play className="w-[18px] h-[18px]" fill="#fff" strokeWidth={0} /> COMEÇAR O DIA{resumo.itens > 0 ? ` · ${resumo.itens} un` : ""}</>}
      </button>
      <button onClick={onComecar} disabled={starting} className="w-full mt-2 py-2 text-[12px] font-semibold underline underline-offset-4 decoration-white/20" style={{ color: "var(--orbis-fg-3)" }}>hoje eu não controlo estoque</button>

      <CargaEscolher aberto={escolher} products={products} loadout={loadout} onFechar={() => setEscolher(false)}
        onLevar={async (itens) => { await levarVarios(itens); }} />
      <AvisoEstoqueCarga aviso={aviso} onTenhoMais={() => { void confirmarAviso(); }} onSoOQueTem={() => { void levarSoOQueTem(); }} onFechar={fecharAviso} />
    </div>
  );
}
