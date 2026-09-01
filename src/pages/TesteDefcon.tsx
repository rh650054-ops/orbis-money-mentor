/* ============================================================
   DEFCON TESTE — protótipo do Foco 2.0 só pro ADMIN.
   Pedido do Rick (01/09): "sobe uma versão teste no painel de
   admin pra eu ver como funciona na prática, não publica pra
   ninguém". Então:
   - Rota /admin/defcon-teste, atrás do useAdminAccess (mesmo
     portão do painel). Quem não é admin vê "sem acesso".
   - NADA vai pro banco. Todo o estado vive na memória desta tela:
     nenhuma venda, custo, estoque ou ranking é gravado. Dá pra
     apertar tudo sem medo — recarregou, zerou.
   O que o protótipo prova, na ordem:
     1) carga do dia (o que ele leva)
     2) tabela de preço por quantidade — 2 un = R$ 30 → desconta 2
     3) venda que CONTA UNIDADE (o bug de hoje: descontava 1)
     4) fechamento: custo de mercadoria automático → lucro → pontes
   ============================================================ */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package, Minus, Plus, Check, Zap, ArrowLeft, Trophy, MessageCircle, Flame,
  BarChart3, ShoppingCart, Info, Bus, Utensils, TrendingUp, RotateCcw,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const brl0 = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));

/* ---- dados de mentira (só existem nesta tela) ---- */
interface Faixa { qty: number; price: number }
interface Prod {
  id: string; nome: string; custo: number; estoque: number;
  faixas: Faixa[]; levar: number; vendido: number;
}
const PRODUTOS_INICIAIS: Prod[] = [
  { id: "agua", nome: "Água 500ml", custo: 1.2, estoque: 120, levar: 60, vendido: 0,
    faixas: [{ qty: 1, price: 20 }, { qty: 2, price: 30 }, { qty: 3, price: 40 }] },
  { id: "refri", nome: "Refrigerante lata", custo: 2.5, estoque: 48, levar: 24, vendido: 0,
    faixas: [{ qty: 1, price: 8 }, { qty: 2, price: 15 }] },
  { id: "bala", nome: "Bala de coco", custo: 0.4, estoque: 200, levar: 0, vendido: 0,
    faixas: [{ qty: 1, price: 2 }, { qty: 5, price: 8 }] },
];

type Passo = "carga" | "precos" | "vendendo" | "custos" | "resultado" | "pontes";
interface Venda { id: number; valor: number; prodId: string; unidades: number; metodo: string }

export default function TesteDefcon() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { whitelisted, role, loading: adminLoading } = useAdminAccess(user?.id);
  const isAdmin = whitelisted && role === "admin";

  const [passo, setPasso] = useState<Passo>("carga");
  const [prods, setProds] = useState<Prod[]>(PRODUTOS_INICIAIS);
  const [prodPrecos, setProdPrecos] = useState<string>("agua"); // qual produto está na tela 2
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [valor, setValor] = useState("");
  const [escolherQtd, setEscolherQtd] = useState<number | null>(null); // valor fora da tabela
  const [transporte, setTransporte] = useState(0);
  const [comida, setComida] = useState(0);
  const metaDia = 1250;

  /* ---- contas ---- */
  const levando = prods.reduce((s, p) => s + p.levar, 0);
  const custoCarga = prods.reduce((s, p) => s + p.levar * p.custo, 0);
  const potencial = prods.reduce((s, p) => {
    const un = p.faixas.find((f) => f.qty === 1)?.price ?? 0;
    return s + p.levar * un;
  }, 0);
  const vendido = vendas.reduce((s, v) => s + v.valor, 0);
  const cmv = vendas.reduce((s, v) => {
    const p = prods.find((x) => x.id === v.prodId);
    return s + (p ? p.custo * v.unidades : 0);
  }, 0);
  const custosTotal = cmv + transporte + comida;
  const lucro = vendido - custosTotal;
  const pct = metaDia > 0 ? Math.min(999, (vendido / metaDia) * 100) : 0;
  const margem = vendido > 0 ? (lucro / vendido) * 100 : 0;

  /* ---- a mágica: valor → quantas unidades ---- */
  const casar = (v: number): { prodId: string; unidades: number } | null => {
    for (const p of prods) {
      if (p.levar <= 0) continue;
      const f = p.faixas.find((x) => Math.abs(x.price - v) < 0.005);
      if (f) return { prodId: p.id, unidades: f.qty };
    }
    return null;
  };
  const valorNum = Number(valor.replace(/\./g, "").replace(",", ".")) || 0;
  const casado = useMemo(() => (valorNum > 0 ? casar(valorNum) : null), [valorNum, prods]);

  const registrar = (metodo: string, unidadesForcadas?: number, prodForcado?: string) => {
    if (!(valorNum > 0)) return;
    const alvo = prodForcado ?? casado?.prodId ?? prods.find((p) => p.levar > 0)?.id ?? "agua";
    const un = unidadesForcadas ?? casado?.unidades ?? 1;
    setVendas((vs) => [...vs, { id: Date.now(), valor: valorNum, prodId: alvo, unidades: un, metodo }]);
    setProds((ps) => ps.map((p) => (p.id === alvo ? { ...p, vendido: p.vendido + un } : p)));
    setValor(""); setEscolherQtd(null);
  };

  const zerar = () => {
    setProds(PRODUTOS_INICIAIS); setVendas([]); setValor(""); setTransporte(0);
    setComida(0); setEscolherQtd(null); setPasso("carga");
  };

  if (authLoading || adminLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground font-mono">carregando…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-8 text-center gap-3">
        <p className="font-display text-[18px] font-extrabold">Área do administrador</p>
        <p className="text-[13px] text-muted-foreground">Esta é uma tela de teste do Orbis. Sua conta não tem acesso.</p>
        <button onClick={() => navigate("/")} className="orbis-cta mt-2 px-6">Voltar</button>
      </div>
    );
  }

  const P = prods.find((p) => p.id === prodPrecos)!;

  return (
    <div className="orbis-stagger max-w-2xl mx-auto pb-10">
      {/* faixa de teste — pra nunca confundir com o app de verdade */}
      <div className="rounded-xl px-3 py-2 flex items-center gap-2 mb-4"
        style={{ background: "rgba(229,115,127,.12)", border: "1px solid rgba(229,115,127,.35)" }}>
        <span className="text-[10.5px] font-extrabold uppercase tracking-[.14em]" style={{ color: "#E5737F" }}>DEFCON teste</span>
        <span className="text-[11.5px] flex-1" style={{ color: "var(--orbis-fg-2)" }}>Nada aqui vai pro banco nem pro ranking.</span>
        <button onClick={zerar} className="inline-flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: "#E5737F" }}>
          <RotateCcw className="w-3 h-3" /> zerar
        </button>
      </div>

      {/* trilha */}
      <div className="flex gap-1.5 mb-4">
        {(["carga", "precos", "vendendo", "custos", "resultado", "pontes"] as Passo[]).map((p, i) => {
          const idx = ["carga", "precos", "vendendo", "custos", "resultado", "pontes"].indexOf(passo);
          return <i key={p} className="h-[3px] flex-1 rounded-full"
            style={{ background: i <= idx ? "var(--orbis-gold)" : "rgba(255,255,255,.10)" }} />;
        })}
      </div>

      {/* ---------- 1 · CARGA ---------- */}
      {passo === "carga" && (
        <>
          <p className="orbis-section">ter, 1 de set</p>
          <h1 className="font-display text-[21px] font-extrabold mt-1 leading-tight">Quanto você vai levar hoje?</h1>
          <p className="text-[13px] mt-2 leading-[1.5]" style={{ color: "var(--orbis-fg-2)" }}>
            O Orbis usa isso pra descontar sozinho a cada venda — e no fim do dia te dizer o que sobrou.
          </p>

          <div className="rounded-[20px] border mt-4 px-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surface)" }}>
            {prods.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 py-3.5"
                style={i > 0 ? { borderTop: "1px solid rgba(255,255,255,.07)" } : undefined}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.05)" }}>
                  <Package className="w-[18px] h-[18px]" style={{ color: p.levar > 0 ? "var(--orbis-gold)" : "var(--orbis-fg-3)" }} />
                </span>
                <span className="flex-1 min-w-0">
                  <b className="block text-[14.5px] font-semibold">{p.nome}</b>
                  <small className="block text-[11.5px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>
                    Tem {p.estoque} no estoque · custo {brl(p.custo)}
                  </small>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setProds((ps) => ps.map((x) => x.id === p.id ? { ...x, levar: Math.max(0, x.levar - 6) } : x))}
                    className="w-8 h-8 rounded-[10px] flex items-center justify-center"
                    style={{ border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)" }}><Minus className="w-4 h-4" /></button>
                  <b className="orbis-num w-8 text-center text-[17px]" style={{ color: p.levar > 0 ? "var(--orbis-fg)" : "var(--orbis-fg-3)" }}>{p.levar}</b>
                  <button onClick={() => setProds((ps) => ps.map((x) => x.id === p.id ? { ...x, levar: Math.min(x.estoque, x.levar + 6) } : x))}
                    className="w-8 h-8 rounded-[10px] flex items-center justify-center"
                    style={{ border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)" }}><Plus className="w-4 h-4" /></button>
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-[18px] border mt-3 p-4 flex items-center gap-3"
            style={{ borderColor: "rgba(245,184,0,.24)", background: "linear-gradient(165deg,#181307 0%,var(--orbis-surface) 55%)" }}>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.14)" }}>
              <Info className="w-[17px] h-[17px]" style={{ color: "var(--orbis-gold)" }} />
            </span>
            <span className="flex-1">
              <b className="block text-[13.5px] font-semibold">Levando {levando} itens · custo {brl0(custoCarga)}</b>
              <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-2)" }}>Se vender tudo, entra {brl0(potencial)}</small>
            </span>
          </div>

          <button onClick={() => setPasso("precos")} className="orbis-cta w-full mt-4">CONFERIR MEUS PREÇOS</button>
        </>
      )}

      {/* ---------- 2 · TABELA DE PREÇO ---------- */}
      {passo === "precos" && (
        <>
          <p className="orbis-section">{P.nome}</p>
          <h1 className="font-display text-[21px] font-extrabold mt-1 leading-tight">Quanto você cobra?</h1>
          <p className="text-[13px] mt-2 leading-[1.5]" style={{ color: "var(--orbis-fg-2)" }}>
            Vende 2 por {brl0(P.faixas.find((f) => f.qty === 2)?.price ?? 30)}? Escreve aqui. Quando registrar esse valor, o Orbis já sabe que saíram <b style={{ color: "var(--orbis-fg)" }}>2 unidades</b> — e desconta 2 do estoque.
          </p>

          {/* trocar de produto */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {prods.map((p) => (
              <button key={p.id} onClick={() => setProdPrecos(p.id)}
                className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold"
                style={p.id === prodPrecos
                  ? { background: "rgba(245,184,0,.12)", border: "1px solid rgba(245,184,0,.35)", color: "var(--orbis-gold)" }
                  : { background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.10)", color: "var(--orbis-fg-3)" }}>
                {p.nome}
              </button>
            ))}
          </div>

          <div className="rounded-[20px] border mt-3 p-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surface)" }}>
            <p className="orbis-section">Sua tabela</p>
            <div className="mt-2">
              {P.faixas.map((f, i) => (
                <div key={f.qty} className="flex items-center gap-3 py-3"
                  style={i > 0 ? { borderTop: "1px solid rgba(255,255,255,.07)" } : undefined}>
                  <span className="w-12 h-8 rounded-[10px] flex items-center justify-center text-[13px] font-bold shrink-0"
                    style={{ background: "rgba(245,184,0,.10)", border: "1px solid rgba(245,184,0,.30)", color: "var(--orbis-gold)" }}>
                    {f.qty} un
                  </span>
                  <span style={{ color: "var(--orbis-fg-3)" }}>→</span>
                  <input inputMode="decimal" value={String(f.price).replace(".", ",")}
                    onChange={(e) => {
                      const v = Number(e.target.value.replace(/\./g, "").replace(",", ".")) || 0;
                      setProds((ps) => ps.map((p) => p.id === P.id
                        ? { ...p, faixas: p.faixas.map((x) => x.qty === f.qty ? { ...x, price: v } : x) } : p));
                    }}
                    className="orbis-num flex-1 h-10 rounded-[10px] px-3 text-[15px] font-bold outline-none"
                    style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.03)", color: "var(--orbis-fg)" }} />
                  <span className="text-[11.5px] w-[74px] text-right" style={{ color: "var(--orbis-fg-3)" }}>
                    {brl(f.price / f.qty)} cada
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setProds((ps) => ps.map((p) => {
                if (p.id !== P.id) return p;
                const prox = (p.faixas[p.faixas.length - 1]?.qty ?? 0) + 1;
                const un = p.faixas.find((f) => f.qty === 1)?.price ?? 10;
                return { ...p, faixas: [...p.faixas, { qty: prox, price: Math.round(un * prox * 0.85) }] };
              }))}
              className="w-full h-10 rounded-xl mt-2 text-[13.5px] font-semibold"
              style={{ border: "1px dashed rgba(245,184,0,.35)", color: "var(--orbis-gold)" }}>
              + adicionar combo
            </button>
          </div>

          <div className="rounded-[18px] border mt-3 p-4 flex items-center gap-3" style={{ borderColor: "rgba(61,214,140,.28)", background: "var(--orbis-surface)" }}>
            <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(61,214,140,.16)" }}>
              <Check className="w-4 h-4" style={{ color: "var(--orbis-ok)" }} strokeWidth={2.8} />
            </span>
            <span className="flex-1">
              <b className="block text-[13.5px] font-semibold">Valor fora da tabela? Sem problema</b>
              <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-2)" }}>O Orbis pergunta quantas unidades saíram.</small>
            </span>
          </div>

          <button onClick={() => setPasso("vendendo")}
            className="w-full h-[50px] rounded-[15px] mt-4 font-extrabold text-[15.5px] text-white"
            style={{ background: "linear-gradient(180deg,#F4616E,#E5484D)", boxShadow: "0 4px 0 #9B2C31" }}>
            INICIAR DEFCON 4
          </button>
          <button onClick={() => setPasso("carga")} className="w-full h-10 mt-2 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ color: "var(--orbis-fg-3)" }}>
            <ArrowLeft className="w-3.5 h-3.5" /> voltar pra carga
          </button>
        </>
      )}

      {/* ---------- 3 · VENDENDO ---------- */}
      {passo === "vendendo" && (
        <>
          <p className="orbis-section">DEFCON 4 · teste</p>
          <h1 className="font-display text-[21px] font-extrabold mt-1 leading-tight">Registrar venda</h1>

          <div className="rounded-[16px] border mt-4 h-[70px] flex items-center px-4 gap-2"
            style={{ borderColor: "rgba(245,184,0,.35)", background: "rgba(245,184,0,.06)" }}>
            <span className="text-[20px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>R$</span>
            <input autoFocus inputMode="decimal" value={valor} onChange={(e) => { setValor(e.target.value); setEscolherQtd(null); }}
              placeholder="0,00"
              className="orbis-num flex-1 bg-transparent outline-none text-[32px] font-extrabold"
              style={{ color: "var(--orbis-fg)" }} />
          </div>

          {valorNum > 0 && casado && (
            <div className="rounded-[14px] border mt-3 p-3.5 flex items-center gap-3"
              style={{ borderColor: "rgba(61,214,140,.30)", background: "rgba(61,214,140,.07)" }}>
              <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(61,214,140,.16)" }}>
                <Check className="w-4 h-4" style={{ color: "var(--orbis-ok)" }} strokeWidth={2.8} />
              </span>
              <span className="flex-1">
                <b className="block text-[14px] font-semibold">{casado.unidades} × {prods.find((p) => p.id === casado.prodId)?.nome}</b>
                <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-2)" }}>Está na sua tabela · sai {casado.unidades} do estoque</small>
              </span>
            </div>
          )}

          {valorNum > 0 && !casado && (
            <div className="rounded-[14px] border mt-3 p-3.5"
              style={{ borderColor: "rgba(245,184,0,.30)", background: "rgba(245,184,0,.06)" }}>
              <p className="text-[13.5px] font-semibold">Esse valor não está na tabela. Quantas unidades saíram?</p>
              <div className="flex gap-2 mt-2.5 flex-wrap">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setEscolherQtd(n)}
                    className="w-11 h-10 rounded-[10px] text-[15px] font-extrabold"
                    style={escolherQtd === n
                      ? { background: "var(--orbis-gold)", color: "#1A1200" }
                      : { border: "1px solid rgba(245,184,0,.3)", color: "var(--orbis-gold)" }}>{n}</button>
                ))}
              </div>
            </div>
          )}

          <p className="orbis-section mt-5">Como recebeu</p>
          <div className="flex gap-2 mt-2">
            {[["dinheiro", "DINHEIRO", "var(--orbis-ok)", "#06231A"], ["pix", "PIX", "var(--orbis-gold)", "#1A1200"], ["cartao", "CARTÃO", "var(--orbis-fg)", "#111"]].map(([k, rot, bg, fg]) => (
              <button key={k as string}
                disabled={!(valorNum > 0) || (!casado && !escolherQtd)}
                onClick={() => registrar(k as string, escolherQtd ?? undefined)}
                className="flex-1 h-14 rounded-[14px] text-[11.5px] font-extrabold tracking-wide disabled:opacity-30"
                style={{ background: bg as string, color: fg as string }}>{rot as string}</button>
            ))}
          </div>

          <div className="rounded-[20px] border mt-5 p-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surface)" }}>
            <div className="flex items-baseline justify-between">
              <p className="orbis-section">Restam hoje</p>
              <span className="orbis-num text-[13px] font-bold">{vendas.length} {vendas.length === 1 ? "venda" : "vendas"} · {brl0(vendido)}</span>
            </div>
            {prods.filter((p) => p.levar > 0).map((p) => {
              const restam = Math.max(0, p.levar - p.vendido);
              const pctRest = p.levar > 0 ? (restam / p.levar) * 100 : 0;
              return (
                <div key={p.id} className="mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13.5px] font-semibold">{p.nome}</span>
                    <span className="orbis-num text-[14px] font-bold" style={{ color: pctRest < 25 ? "var(--orbis-custo)" : "var(--orbis-ok)" }}>{restam}</span>
                  </div>
                  <small className="block text-[11.5px]" style={{ color: "var(--orbis-fg-3)" }}>Levou {p.levar} · vendeu {p.vendido}</small>
                  <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,.09)" }}>
                    <i className="block h-full rounded-full" style={{ width: `${pctRest}%`, background: pctRest < 25 ? "var(--orbis-custo)" : "var(--orbis-ok)" }} />
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={() => setPasso("custos")} className="w-full h-11 rounded-[14px] mt-4 text-[13.5px] font-bold"
            style={{ border: "1px solid rgba(229,115,127,.4)", color: "#E5737F" }}>
            ENCERRAR O DIA
          </button>
        </>
      )}

      {/* ---------- 4 · CUSTOS ---------- */}
      {passo === "custos" && (
        <>
          <p className="orbis-section">ter, 1 de set · fechamento</p>
          <h1 className="font-display text-[21px] font-extrabold mt-1 leading-tight">
            Vendeu {brl0(vendido)}.<br />Quanto sobrou pra você?
          </h1>

          <div className="rounded-[20px] border mt-4 px-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surface)" }}>
            <div className="flex items-center gap-3 py-3.5">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.05)" }}>
                <Package className="w-[17px] h-[17px]" style={{ color: "var(--orbis-ok)" }} />
              </span>
              <span className="flex-1 min-w-0">
                <b className="block text-[14px] font-semibold">
                  Mercadoria <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[.06em]" style={{ background: "rgba(61,214,140,.13)", color: "var(--orbis-ok)" }}>automático</span>
                </b>
                <small className="block text-[11.5px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>
                  {vendas.reduce((s, v) => s + v.unidades, 0)} unidades vendidas × custo do catálogo
                </small>
              </span>
              <span className="rounded-full px-3 py-1.5 text-[12.5px] font-bold orbis-num shrink-0"
                style={{ background: "rgba(61,214,140,.10)", border: "1px solid rgba(61,214,140,.35)", color: "var(--orbis-ok)" }}>{brl0(cmv)}</span>
            </div>

            {([["Transporte", Bus, transporte, setTransporte, 20], ["Comida", Utensils, comida, setComida, 25]] as const).map(([rot, Icone, val, setVal, sug]) => (
              <div key={rot} className="flex items-center gap-3 py-3.5" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.05)" }}>
                  <Icone className="w-[17px] h-[17px]" style={{ color: "var(--orbis-fg-2)" }} />
                </span>
                <span className="flex-1 min-w-0">
                  <b className="block text-[14px] font-semibold">{rot}</b>
                  <small className="block text-[11.5px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>Ontem você gastou {brl0(sug)}</small>
                </span>
                <button onClick={() => setVal(val === sug ? 0 : sug)}
                  className="rounded-full px-3 py-1.5 text-[12.5px] font-bold orbis-num shrink-0"
                  style={val === sug
                    ? { background: "var(--orbis-gold)", color: "#1A1200" }
                    : { background: "rgba(245,184,0,.08)", border: "1px solid rgba(245,184,0,.35)", color: "var(--orbis-gold)" }}>
                  {brl0(sug)}
                </button>
              </div>
            ))}
          </div>

          <button onClick={() => setPasso("resultado")} className="orbis-cta w-full mt-4">VER MEU LUCRO</button>
          <p className="text-[12px] text-center mt-3 leading-[1.55]" style={{ color: "var(--orbis-fg-3)" }}>
            Sem custo lançado, o lucro é chute.<br />A mercadoria o Orbis já calcula sozinho pra você.
          </p>
        </>
      )}

      {/* ---------- 5 · RESULTADO ---------- */}
      {passo === "resultado" && (
        <>
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[.08em]"
              style={{ border: `1px solid ${vendido >= metaDia ? "rgba(61,214,140,.35)" : "rgba(255,255,255,.14)"}`, background: vendido >= metaDia ? "rgba(61,214,140,.10)" : "rgba(255,255,255,.04)", color: vendido >= metaDia ? "var(--orbis-ok)" : "var(--orbis-fg-2)" }}>
              {vendido >= metaDia ? <><Check className="w-3 h-3" strokeWidth={3} /> Meta batida · {Math.round(pct)}%</> : <>Dia encerrado · {Math.round(pct)}% da meta</>}
            </span>
          </div>

          <div className="orbis-card-in rounded-[22px] border mt-3 p-5 text-center"
            style={{ borderColor: vendido >= metaDia ? "rgba(61,214,140,.28)" : "rgba(245,184,0,.24)", background: vendido >= metaDia ? "linear-gradient(165deg,#0d1a12 0%,var(--orbis-surface) 55%)" : "linear-gradient(165deg,#181307 0%,var(--orbis-surface) 55%)" }}>
            <p className="orbis-label" style={{ color: vendido >= metaDia ? "var(--orbis-ok)" : "var(--orbis-gold)" }}>Sobrou pra você</p>
            <p className="orbis-num text-[38px] font-extrabold mt-2 leading-none">{brl(lucro)}</p>
            <div className="flex mt-4 pt-3.5" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <div className="flex-1 text-left"><p className="text-[10.5px] font-semibold uppercase tracking-[.06em]" style={{ color: "var(--orbis-fg-3)" }}>Vendido</p><p className="orbis-num text-[16px] font-extrabold mt-1">{brl0(vendido)}</p></div>
              <div className="flex-1 text-left pl-3" style={{ borderLeft: "1px solid rgba(255,255,255,.08)" }}><p className="text-[10.5px] font-semibold uppercase tracking-[.06em]" style={{ color: "var(--orbis-fg-3)" }}>Custos</p><p className="orbis-num text-[16px] font-extrabold mt-1" style={{ color: "var(--orbis-custo)" }}>{brl0(custosTotal)}</p></div>
              <div className="flex-1 text-left pl-3" style={{ borderLeft: "1px solid rgba(255,255,255,.08)" }}><p className="text-[10.5px] font-semibold uppercase tracking-[.06em]" style={{ color: "var(--orbis-fg-3)" }}>Margem</p><p className="orbis-num text-[16px] font-extrabold mt-1" style={{ color: "var(--orbis-ok)" }}>{Math.round(margem)}%</p></div>
            </div>
          </div>

          <div className="rounded-[18px] border mt-3 p-4 flex items-center gap-3" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surface)" }}>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.12)" }}>
              <TrendingUp className="w-[17px] h-[17px]" style={{ color: "var(--orbis-gold)" }} />
            </span>
            <span className="flex-1">
              <b className="block text-[14px] font-semibold">{vendas.length} vendas · {vendas.reduce((s, v) => s + v.unidades, 0)} unidades</b>
              <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-2)" }}>
                Ticket médio {brl(vendas.length ? vendido / vendas.length : 0)}
              </small>
            </span>
          </div>

          <button onClick={() => setPasso("pontes")} className="orbis-cta w-full mt-4">VER O QUE ISSO MEXEU</button>
        </>
      )}

      {/* ---------- 6 · PONTES ---------- */}
      {passo === "pontes" && (
        <>
          <p className="orbis-section">ter, 1 de set</p>
          <h1 className="font-display text-[21px] font-extrabold mt-1 leading-tight">O que o dia de hoje mexeu</h1>

          {[
            { Icone: Trophy, tom: "gold", t: "Subiu 2 lugares — agora é #3", s: "Faltam R$ 210 pro segundo lugar" },
            { Icone: MessageCircle, tom: "red", t: "R$ 40 ficaram de pagar", s: "2 clientes · cobrar no WhatsApp agora" },
            { Icone: Flame, tom: "gray", t: "4 dias seguidos", s: "Amanhã é folga — a sequência não quebra" },
            { Icone: BarChart3, tom: "gray", t: "Ver este dia no relatório", s: "Hora a hora, o que vendeu mais" },
          ].map(({ Icone, tom, t, s }) => (
            <div key={t} className="rounded-[16px] border mt-2.5 p-3.5 flex items-center gap-3"
              style={tom === "gold" ? { borderColor: "rgba(245,184,0,.28)", background: "rgba(245,184,0,.07)" }
                : tom === "red" ? { borderColor: "rgba(229,115,127,.35)", background: "rgba(229,115,127,.07)" }
                : { borderColor: "rgba(255,255,255,.10)", background: "rgba(255,255,255,.035)" }}>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={tom === "gold" ? { background: "linear-gradient(180deg,#FFC63A,#F5B800)", boxShadow: "0 3px 0 #B88700" }
                  : tom === "red" ? { background: "linear-gradient(180deg,#F08F99,#E5737F)", boxShadow: "0 3px 0 #8E3A42" }
                  : { background: "rgba(255,255,255,.07)" }}>
                <Icone className="w-[17px] h-[17px]" style={{ color: tom === "gray" ? "var(--orbis-fg-2)" : "#1A1200" }} strokeWidth={2.2} />
              </span>
              <span className="flex-1">
                <b className="block text-[14px] font-semibold">{t}</b>
                <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-2)" }}>{s}</small>
              </span>
            </div>
          ))}

          <p className="orbis-section mt-5">Seu estoque depois de hoje</p>
          <div className="rounded-[20px] border mt-2 p-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surface)" }}>
            {prods.filter((p) => p.levar > 0).map((p) => {
              const voltou = Math.max(0, p.levar - p.vendido);
              const restamCasa = p.estoque - p.vendido;
              const pctRest = p.estoque > 0 ? (restamCasa / p.estoque) * 100 : 0;
              const acabando = pctRest < 30;
              return (
                <div key={p.id} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13.5px] font-semibold">{p.nome}</span>
                    <span className="orbis-num text-[14px] font-bold" style={{ color: acabando ? "var(--orbis-custo)" : "var(--orbis-ok)" }}>Restam {restamCasa}</span>
                  </div>
                  <small className="block text-[11.5px]" style={{ color: "var(--orbis-fg-3)" }}>Levou {p.levar} · vendeu {p.vendido} · voltou {voltou}</small>
                  <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,.09)" }}>
                    <i className="block h-full rounded-full" style={{ width: `${Math.max(3, pctRest)}%`, background: acabando ? "var(--orbis-custo)" : "var(--orbis-ok)" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {prods.some((p) => p.levar > 0 && (p.estoque - p.vendido) / p.estoque < 0.3) && (
            <div className="rounded-[16px] border mt-3 p-3.5 flex items-center gap-3"
              style={{ borderColor: "rgba(229,115,127,.35)", background: "rgba(229,115,127,.07)" }}>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(180deg,#F08F99,#E5737F)", boxShadow: "0 3px 0 #8E3A42" }}>
                <ShoppingCart className="w-[17px] h-[17px]" style={{ color: "#3A0F14" }} strokeWidth={2.3} />
              </span>
              <span className="flex-1">
                <b className="block text-[14px] font-semibold">Precisa comprar mercadoria</b>
                <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-2)" }}>
                  {prods.filter((p) => p.levar > 0 && (p.estoque - p.vendido) / p.estoque < 0.3).map((p) => p.nome).join(", ")} está acabando
                </small>
              </span>
            </div>
          )}

          <div className="rounded-[18px] border mt-4 p-4" style={{ borderColor: "rgba(245,184,0,.24)", background: "linear-gradient(165deg,#181307 0%,var(--orbis-surface) 55%)" }}>
            <p className="orbis-section">Amanhã</p>
            <p className="text-[13px] mt-1.5" style={{ color: "var(--orbis-fg-2)" }}>
              Você começa às <b style={{ color: "var(--orbis-fg)" }}>7h</b> · meta de <b style={{ color: "var(--orbis-fg)" }}>{brl0(metaDia)}</b>
            </p>
            <p className="text-[12.5px] mt-1.5" style={{ color: "var(--orbis-fg-3)" }}>
              Mantendo o ritmo de hoje, fecha o mês em <b style={{ color: "var(--orbis-gold)" }}>{brl0(vendido * 26)}</b>
            </p>
          </div>

          <button onClick={zerar} className="w-full h-12 rounded-[15px] mt-4 text-[14px] font-bold inline-flex items-center justify-center gap-2"
            style={{ background: "rgba(245,184,0,.10)", border: "1px solid rgba(245,184,0,.3)", color: "var(--orbis-gold)" }}>
            <RotateCcw className="w-4 h-4" /> Rodar o teste de novo
          </button>
          <button onClick={() => navigate("/admin")} className="w-full h-10 mt-2 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ color: "var(--orbis-fg-3)" }}>
            <ArrowLeft className="w-3.5 h-3.5" /> voltar pro painel
          </button>
        </>
      )}
    </div>
  );
}
