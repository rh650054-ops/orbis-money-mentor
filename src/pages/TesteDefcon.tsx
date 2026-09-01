/* ============================================================
   DEFCON TESTE — protótipo do fluxo novo, só pro ADMIN.
   Rota /admin/defcon-teste, atrás do useAdminAccess.
   NADA vai pro banco: tudo vive na memória desta tela.

   ORDEM CORRIGIDA pelo Rick (01/09):
     1. MODO DESAFIO  → a tela que já existe, do jeito que está
     2. CARGA DO DIA  → escolhe entre os produtos JÁ cadastrados;
                        se não tem nenhum, oferece cadastrar agora
     3. (cadastro)    → é AQUI que mora "quanto você cobra?" —
                        a tabela de preço por quantidade fica no
                        cadastro do produto, aparece uma vez só
     4. DEFCON rodando → o padrão atual (timer, Venda/Abordagem/
                        Gorjeta). Só a folha de venda ganhou a
                        contagem de unidades.
     5. Fechamento    → custos (mercadoria automática) → lucro →
                        pontes + estoque
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package, Minus, Plus, Check, ArrowLeft, Trophy, MessageCircle, Flame,
  BarChart3, ShoppingCart, Info, Bus, Utensils, TrendingUp, RotateCcw,
  UserRound, Coins, FileText, UtensilsCrossed, BatteryFull, X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const brl0 = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

interface Faixa { qty: number; price: number }
interface Prod { id: string; nome: string; custo: number; estoque: number; faixas: Faixa[]; levar: number; vendido: number }
interface Venda { id: number; valor: number; prodId: string | null; unidades: number; metodo: string }

const CATALOGO: Prod[] = [
  { id: "agua", nome: "Água 500ml", custo: 1.2, estoque: 120, levar: 0, vendido: 0, faixas: [{ qty: 1, price: 20 }, { qty: 2, price: 30 }, { qty: 3, price: 40 }] },
  { id: "refri", nome: "Refrigerante lata", custo: 2.5, estoque: 48, levar: 0, vendido: 0, faixas: [{ qty: 1, price: 8 }, { qty: 2, price: 15 }] },
];

type Passo = "desafio" | "carga" | "cadastro" | "rodando" | "custos" | "resultado" | "pontes";

export default function TesteDefcon() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { whitelisted, role, loading: adminLoading } = useAdminAccess(user?.id);
  const isAdmin = whitelisted && role === "admin";

  const [passo, setPasso] = useState<Passo>("desafio");
  const [contaVazia, setContaVazia] = useState(false); // simula "não cadastrou nada ainda"
  const [prods, setProds] = useState<Prod[]>(CATALOGO);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [economia, setEconomia] = useState(false);

  // folha de venda (padrão do DEFCON de hoje)
  const [folha, setFolha] = useState(false);
  const [valor, setValor] = useState("");
  const [qtdManual, setQtdManual] = useState<number | null>(null);
  const [abordagens, setAbordagens] = useState(0);
  const [inicio, setInicio] = useState<Date | null>(null);
  const [agora, setAgora] = useState(Date.now());

  // cadastro de produto (com a tabela de preço)
  const [novo, setNovo] = useState<{ nome: string; custo: string; faixas: Faixa[] }>({ nome: "", custo: "", faixas: [{ qty: 1, price: 0 }] });

  const [transporte, setTransporte] = useState(0);
  const [comida, setComida] = useState(0);
  const metaDia = 1000;

  useEffect(() => {
    if (passo !== "rodando" || !inicio) return;
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [passo, inicio]);

  /* ---- contas ---- */
  const disponiveis = contaVazia ? [] : prods;
  const levando = prods.reduce((s, p) => s + p.levar, 0);
  const custoCarga = prods.reduce((s, p) => s + p.levar * p.custo, 0);
  const potencial = prods.reduce((s, p) => s + p.levar * (p.faixas.find((f) => f.qty === 1)?.price ?? 0), 0);
  const vendido = vendas.reduce((s, v) => s + v.valor, 0);
  const cmv = vendas.reduce((s, v) => { const p = prods.find((x) => x.id === v.prodId); return s + (p ? p.custo * v.unidades : 0); }, 0);
  const custosTotal = cmv + transporte + comida;
  const lucro = vendido - custosTotal;
  const pct = Math.min(999, (vendido / metaDia) * 100);
  const margem = vendido > 0 ? (lucro / vendido) * 100 : 0;
  const falta = Math.max(0, metaDia - vendido);
  const decorrido = inicio ? Math.floor((agora - inicio.getTime()) / 1000) : 0;
  const restante = Math.max(0, 3600 - (decorrido % 3600));
  const fimBloco = inicio ? new Date(inicio.getTime() + 3600_000) : null;

  const valorNum = Number(valor.replace(/\./g, "").replace(",", ".")) || 0;
  const casado = useMemo(() => {
    if (!(valorNum > 0)) return null;
    for (const p of prods) {
      if (p.levar <= 0) continue;
      const f = p.faixas.find((x) => Math.abs(x.price - valorNum) < 0.005);
      if (f) return { prodId: p.id, unidades: f.qty };
    }
    return null;
  }, [valorNum, prods]);
  const temCarga = levando > 0;

  /* Valor registrado 2+ vezes hoje vira botão de venda rápida — e fica fixo
     até o fim do dia (contador só cresce). Guarda também o método mais usado
     naquele valor, pra o toque rápido não gravar tudo como Pix. */
  const rapidos = useMemo(() => {
    const conta = new Map<number, { n: number; metodos: Record<string, number> }>();
    for (const v of vendas) {
      const at = conta.get(v.valor) ?? { n: 0, metodos: {} };
      at.n += 1;
      at.metodos[v.metodo] = (at.metodos[v.metodo] ?? 0) + 1;
      conta.set(v.valor, at);
    }
    return Array.from(conta.entries())
      .filter(([, c]) => c.n >= 2)
      .sort((a, b) => b[1].n - a[1].n || a[0] - b[0])
      .slice(0, 3)
      .map(([valor, c]) => ({
        valor,
        metodo: Object.entries(c.metodos).sort((x, y) => y[1] - x[1])[0]![0],
      }));
  }, [vendas]);

  const registrarDireto = (v: number, metodo: string) => {
    const alvo = (() => {
      for (const p of prods) {
        if (p.levar <= 0) continue;
        const f = p.faixas.find((x) => Math.abs(x.price - v) < 0.005);
        if (f) return { prodId: p.id, unidades: f.qty };
      }
      return null;
    })();
    setVendas((vs) => [...vs, { id: Date.now(), valor: v, prodId: alvo?.prodId ?? null, unidades: alvo?.unidades ?? 0, metodo }]);
    if (alvo) setProds((ps) => ps.map((p) => (p.id === alvo.prodId ? { ...p, vendido: p.vendido + alvo.unidades } : p)));
    setAbordagens((a) => a + 1);
  };

  const registrar = (metodo: string) => {
    if (!(valorNum > 0)) return;
    const un = casado?.unidades ?? qtdManual ?? 1;
    const alvo = casado?.prodId ?? (temCarga ? prods.find((p) => p.levar > 0)!.id : null);
    setVendas((vs) => [...vs, { id: Date.now(), valor: valorNum, prodId: alvo, unidades: alvo ? un : 0, metodo }]);
    if (alvo) setProds((ps) => ps.map((p) => (p.id === alvo ? { ...p, vendido: p.vendido + un } : p)));
    setAbordagens((a) => a + 1); // o app já conta abordagem por venda
    setValor(""); setQtdManual(null); setFolha(false);
  };

  const zerar = () => {
    setPasso("desafio"); setProds(CATALOGO); setVendas([]); setValor(""); setQtdManual(null);
    setTransporte(0); setComida(0); setAbordagens(0); setInicio(null); setConfirmando(false);
    setContaVazia(false); setNovo({ nome: "", custo: "", faixas: [{ qty: 1, price: 0 }] });
  };

  if (authLoading || adminLoading) return <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground font-mono">carregando…</div>;
  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-8 text-center gap-3">
        <p className="font-display text-[18px] font-extrabold">Área do administrador</p>
        <p className="text-[13px] text-muted-foreground">Esta é uma tela de teste do Orbis. Sua conta não tem acesso.</p>
        <button onClick={() => navigate("/")} className="orbis-cta mt-2 px-6">Voltar</button>
      </div>
    );
  }

  const Faixa = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-xl px-3 py-2 flex items-center gap-2 mb-3" style={{ background: "rgba(229,115,127,.12)", border: "1px solid rgba(229,115,127,.35)" }}>
      <span className="text-[10.5px] font-extrabold uppercase tracking-[.14em] shrink-0" style={{ color: "#E5737F" }}>DEFCON teste</span>
      <span className="text-[11.5px] flex-1 min-w-0" style={{ color: "var(--orbis-fg-2)" }}>{children}</span>
      <button onClick={zerar} className="inline-flex items-center gap-1 text-[11.5px] font-semibold shrink-0" style={{ color: "#E5737F" }}>
        <RotateCcw className="w-3 h-3" /> zerar
      </button>
    </div>
  );

  /* ============ 1 · MODO DESAFIO (a tela que já existe) ============ */
  if (passo === "desafio") {
    return (
      <div className="max-w-2xl mx-auto pb-10">
        <Faixa>Nada aqui vai pro banco nem pro ranking.</Faixa>
        <div className="min-h-[76vh] flex flex-col select-none">
          <div className="pt-2 text-center">
            <div className="text-xs font-mono text-destructive tracking-[0.5em] uppercase">DEFCON 4</div>
          </div>
          <div className="flex-1 flex flex-col justify-center min-h-0 gap-6 py-8">
            <div className="text-center">
              <h1 className="text-4xl font-black tracking-tight leading-none">MODO<br />DESAFIO</h1>
              <p className="text-xs text-muted-foreground font-mono mt-3 max-w-[240px] mx-auto">Blocos de 60min. Sem distrações. Apenas vendas.</p>
            </div>
            <div className="bg-card/70 border border-border rounded-2xl p-5 space-y-3.5">
              <div className="flex justify-between items-center"><span className="text-xs font-mono text-muted-foreground">Meta do dia</span><span className="font-black text-xl text-primary">{brl(metaDia)}</span></div>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center"><span className="text-xs font-mono text-muted-foreground">Blocos</span><span className="font-black text-base">10 × 60min</span></div>
              <div className="flex justify-between items-center"><span className="text-xs font-mono text-muted-foreground">Pausa</span><span className="font-black text-base text-muted-foreground">5 min</span></div>
            </div>
            <button onClick={() => setEconomia((e) => !e)} className={`flex items-center justify-between gap-3 px-4 h-12 rounded-xl border ${economia ? "bg-success/10 border-success/30" : "bg-card/50 border-border"}`}>
              <div className="flex items-center gap-2.5">
                <BatteryFull className={`w-4 h-4 ${economia ? "text-success" : "text-muted-foreground"}`} />
                <div className="text-left">
                  <p className="text-xs font-semibold leading-tight">Economia de bateria</p>
                  <p className="text-xs text-muted-foreground leading-tight">{economia ? "Animações reduzidas" : "Para celulares fracos"}</p>
                </div>
              </div>
              <div className={`w-9 h-5 rounded-full relative transition-colors ${economia ? "bg-success" : "bg-muted"}`}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${economia ? "translate-x-4" : ""}`} />
              </div>
            </button>
          </div>
          <div className="pb-2 space-y-2">
            <button onClick={() => setPasso("carga")} className="w-full h-14 rounded-2xl font-black text-base bg-destructive text-destructive-foreground active:scale-[0.98] transition">
              INICIAR DEFCON 4
            </button>
            <button onClick={() => navigate("/admin")} className="w-full h-10 text-muted-foreground font-mono text-xs">Sair</button>
          </div>
        </div>
      </div>
    );
  }

  /* ============ 2 · CARGA DO DIA ============ */
  if (passo === "carga") {
    return (
      <div className="orbis-stagger max-w-2xl mx-auto pb-10">
        <Faixa>Escolha o que leva. Nada vai pro banco.</Faixa>
        <p className="orbis-section">Antes de começar</p>
        <h1 className="font-display text-[21px] font-extrabold mt-1 leading-tight">Quanto você vai levar hoje?</h1>
        <p className="text-[13px] mt-2 leading-[1.5]" style={{ color: "var(--orbis-fg-2)" }}>
          O Orbis desconta sozinho a cada venda — e no fim do dia te diz o que sobrou.
        </p>

        {/* botão só do teste: simular conta sem produto */}
        <button onClick={() => setContaVazia((v) => !v)} className="mt-3 text-[11.5px] font-semibold underline" style={{ color: "var(--orbis-fg-3)" }}>
          {contaVazia ? "◂ simular conta COM produtos" : "simular conta SEM produtos cadastrados ▸"}
        </button>

        {disponiveis.length === 0 ? (
          /* --- estado vazio: oferece cadastrar --- */
          <div className="rounded-[20px] border mt-4 p-5 text-center" style={{ borderColor: "rgba(245,184,0,.24)", background: "linear-gradient(165deg,#181307 0%,var(--orbis-surface) 55%)" }}>
            <span className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(245,184,0,.14)" }}>
              <Package className="w-6 h-6" style={{ color: "var(--orbis-gold)" }} />
            </span>
            <p className="font-display text-[17px] font-extrabold mt-3">Você ainda não cadastrou seus produtos</p>
            <p className="text-[13px] mt-2 leading-[1.5]" style={{ color: "var(--orbis-fg-2)" }}>
              Cadastrando o que você vende, o Orbis desconta o estoque sozinho, calcula seu lucro real e avisa quando a mercadoria vai acabar.
            </p>
            <button onClick={() => setPasso("cadastro")} className="orbis-cta w-full mt-4">CADASTRAR O QUE VOU LEVAR HOJE</button>
            <button onClick={() => { setContaVazia(false); setPasso("rodando"); setInicio(new Date()); }}
              className="w-full h-10 mt-2 text-[13px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>
              hoje eu não controlo estoque
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-[20px] border mt-4 px-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surface)" }}>
              {prods.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 py-3.5" style={i > 0 ? { borderTop: "1px solid rgba(255,255,255,.07)" } : undefined}>
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.05)" }}>
                    <Package className="w-[18px] h-[18px]" style={{ color: p.levar > 0 ? "var(--orbis-gold)" : "var(--orbis-fg-3)" }} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <b className="block text-[14.5px] font-semibold">{p.nome}</b>
                    <small className="block text-[11.5px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>
                      Tem {p.estoque} no estoque · {p.faixas.length > 1 ? `${p.faixas.length} preços` : brl(p.faixas[0]!.price)}
                    </small>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setProds((ps) => ps.map((x) => x.id === p.id ? { ...x, levar: Math.max(0, x.levar - 6) } : x))}
                      className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)" }}><Minus className="w-4 h-4" /></button>
                    <b className="orbis-num w-8 text-center text-[17px]" style={{ color: p.levar > 0 ? "var(--orbis-fg)" : "var(--orbis-fg-3)" }}>{p.levar}</b>
                    <button onClick={() => setProds((ps) => ps.map((x) => x.id === p.id ? { ...x, levar: Math.min(x.estoque, x.levar + 6) } : x))}
                      className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)" }}><Plus className="w-4 h-4" /></button>
                  </span>
                </div>
              ))}
              <button onClick={() => setPasso("cadastro")} className="w-full h-11 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ borderTop: "1px solid rgba(255,255,255,.07)", color: "var(--orbis-gold)" }}>
                <Plus className="w-4 h-4" /> cadastrar outro produto
              </button>
            </div>

            {levando > 0 && (
              <div className="rounded-[18px] border mt-3 p-4 flex items-center gap-3" style={{ borderColor: "rgba(245,184,0,.24)", background: "linear-gradient(165deg,#181307 0%,var(--orbis-surface) 55%)" }}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.14)" }}><Info className="w-[17px] h-[17px]" style={{ color: "var(--orbis-gold)" }} /></span>
                <span className="flex-1">
                  <b className="block text-[13.5px] font-semibold">Levando {levando} itens · custo {brl0(custoCarga)}</b>
                  <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-2)" }}>Se vender tudo, entra {brl0(potencial)}</small>
                </span>
              </div>
            )}

            <button onClick={() => { setPasso("rodando"); setInicio(new Date()); }}
              className="w-full h-[52px] rounded-2xl mt-4 font-black text-base bg-destructive text-destructive-foreground active:scale-[0.98] transition">
              COMEÇAR O DIA
            </button>
            <button onClick={() => { setPasso("rodando"); setInicio(new Date()); }} className="w-full h-10 mt-1 text-[13px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>
              hoje eu não controlo estoque
            </button>
          </>
        )}
      </div>
    );
  }

  /* ============ 3 · CADASTRO DO PRODUTO (onde mora a tabela de preço) ============ */
  if (passo === "cadastro") {
    const salvar = () => {
      const nome = novo.nome.trim() || "Produto novo";
      const custo = Number(novo.custo.replace(",", ".")) || 0;
      const faixas = novo.faixas.filter((f) => f.price > 0);
      const id = `p${Date.now()}`;
      setProds((ps) => [...ps, { id, nome, custo, estoque: 0, levar: 0, vendido: 0, faixas: faixas.length ? faixas : [{ qty: 1, price: 0 }] }]);
      setContaVazia(false);
      setNovo({ nome: "", custo: "", faixas: [{ qty: 1, price: 0 }] });
      setPasso("carga");
    };
    return (
      <div className="orbis-stagger max-w-2xl mx-auto pb-10">
        <Faixa>Produtos e estoque · cadastro</Faixa>
        <p className="orbis-section">Produtos e estoque</p>
        <h1 className="font-display text-[21px] font-extrabold mt-1 leading-tight">Cadastrar produto</h1>

        <div className="rounded-[20px] border mt-4 p-4 space-y-3" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surface)" }}>
          <div>
            <label className="orbis-section">O que você vende</label>
            <input value={novo.nome} onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))} placeholder="Ex.: Água 500ml"
              className="w-full h-11 rounded-xl px-3 mt-1.5 text-[15px] outline-none"
              style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.03)", color: "var(--orbis-fg)" }} />
          </div>
          <div>
            <label className="orbis-section">Quanto te custa (por unidade)</label>
            <input inputMode="decimal" value={novo.custo} onChange={(e) => setNovo((n) => ({ ...n, custo: e.target.value }))} placeholder="1,20"
              className="orbis-num w-full h-11 rounded-xl px-3 mt-1.5 text-[15px] outline-none"
              style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.03)", color: "var(--orbis-fg)" }} />
          </div>
        </div>

        {/* --- A TABELA DE PREÇO VIVE AQUI --- */}
        <div className="rounded-[20px] border mt-3 p-4" style={{ borderColor: "rgba(245,184,0,.24)", background: "linear-gradient(165deg,#181307 0%,var(--orbis-surface) 55%)" }}>
          <p className="orbis-label">Quanto você cobra</p>
          <p className="text-[12.5px] mt-1.5 leading-[1.5]" style={{ color: "var(--orbis-fg-2)" }}>
            Vende 2 por um preço melhor? Escreve aqui. Depois, quando registrar esse valor no DEFCON, o Orbis já sabe que saíram <b style={{ color: "var(--orbis-fg)" }}>2 unidades</b> — e desconta 2 do estoque.
          </p>
          <div className="mt-3">
            {novo.faixas.map((f, i) => (
              <div key={f.qty} className="flex items-center gap-3 py-2.5" style={i > 0 ? { borderTop: "1px solid rgba(255,255,255,.07)" } : undefined}>
                <span className="w-12 h-8 rounded-[10px] flex items-center justify-center text-[13px] font-bold shrink-0"
                  style={{ background: "rgba(245,184,0,.10)", border: "1px solid rgba(245,184,0,.30)", color: "var(--orbis-gold)" }}>{f.qty} un</span>
                <span style={{ color: "var(--orbis-fg-3)" }}>→</span>
                <input inputMode="decimal" placeholder="0,00" value={f.price ? String(f.price).replace(".", ",") : ""}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(/\./g, "").replace(",", ".")) || 0;
                    setNovo((n) => ({ ...n, faixas: n.faixas.map((x) => x.qty === f.qty ? { ...x, price: v } : x) }));
                  }}
                  className="orbis-num flex-1 h-10 rounded-[10px] px-3 text-[15px] font-bold outline-none"
                  style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.03)", color: "var(--orbis-fg)" }} />
                <span className="text-[11.5px] w-[70px] text-right" style={{ color: "var(--orbis-fg-3)" }}>
                  {f.price > 0 ? `${brl(f.price / f.qty)} cada` : ""}
                </span>
                {novo.faixas.length > 1 && (
                  <button onClick={() => setNovo((n) => ({ ...n, faixas: n.faixas.filter((x) => x.qty !== f.qty) }))} className="shrink-0"><X className="w-4 h-4" style={{ color: "var(--orbis-fg-3)" }} /></button>
                )}
              </div>
            ))}
          </div>
          <button onClick={() => setNovo((n) => ({ ...n, faixas: [...n.faixas, { qty: (n.faixas[n.faixas.length - 1]?.qty ?? 0) + 1, price: 0 }] }))}
            className="w-full h-10 rounded-xl mt-2 text-[13.5px] font-semibold" style={{ border: "1px dashed rgba(245,184,0,.35)", color: "var(--orbis-gold)" }}>
            + adicionar combo
          </button>
        </div>

        <div className="rounded-[18px] border mt-3 p-4 flex items-center gap-3" style={{ borderColor: "rgba(61,214,140,.28)", background: "var(--orbis-surface)" }}>
          <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(61,214,140,.16)" }}><Check className="w-4 h-4" style={{ color: "var(--orbis-ok)" }} strokeWidth={2.8} /></span>
          <span className="flex-1">
            <b className="block text-[13.5px] font-semibold">Você faz isso uma vez só</b>
            <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-2)" }}>Depois é só dizer quantos leva por dia.</small>
          </span>
        </div>

        <button onClick={salvar} className="orbis-cta w-full mt-4">SALVAR PRODUTO</button>
        <button onClick={() => setPasso("carga")} className="w-full h-10 mt-2 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ color: "var(--orbis-fg-3)" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> voltar
        </button>
      </div>
    );
  }

  /* ============ 4 · DEFCON RODANDO (padrão atual) ============ */
  if (passo === "rodando") {
    const mm = String(Math.floor(restante / 60)).padStart(2, "0");
    const ss = String(restante % 60).padStart(2, "0");
    return (
      <div className="max-w-2xl mx-auto pb-8 select-none">
        <Faixa>DEFCON de teste · nada é gravado.</Faixa>

        <div className="pt-2 pb-1 text-center">
          <div className="text-xs font-mono text-muted-foreground tracking-[0.3em] uppercase mb-1 inline-flex items-center gap-1.5 justify-center">
            <Flame className="w-3.5 h-3.5" style={{ color: "#E5737F" }} /> MISSÃO
          </div>
          <div className="text-2xl font-black tracking-tight leading-tight">
            {falta > 0 ? <>Faltam <span className="text-primary">{brl(falta)}</span> para a meta</> : <>Meta batida — <span className="text-primary">{brl(vendido)}</span></>}
          </div>
          <div className="mt-1 text-xs font-mono text-muted-foreground">
            Meta: {brl(metaDia)} • Feito: <span className="text-success">{brl(vendido)}</span>
          </div>
        </div>

        <div className="text-center mt-5">
          <div className="text-xs font-mono text-muted-foreground/70 tracking-[0.3em] uppercase">
            Bloco #1 • {inicio ? hhmm(inicio) : "--:--"} → {fimBloco ? hhmm(fimBloco) : "--:--"}
          </div>
          <div className="text-[clamp(56px,22vw,96px)] font-black font-mono tabular-nums tracking-tighter leading-none mt-2">
            {mm}<span className="text-primary/40">:</span>{ss}
          </div>
          <div className="w-56 h-1.5 rounded-full mx-auto mt-3 overflow-hidden" style={{ background: "rgba(255,255,255,.09)" }}>
            <i className="block h-full" style={{ width: `${((3600 - restante) / 3600) * 100}%`, background: "var(--orbis-gold)" }} />
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 mt-7 text-center">
          <div><p className="text-[9px] font-mono text-muted-foreground/70 tracking-[0.1em] uppercase">Bloco</p><p className="font-black text-success text-[17px] font-mono tabular-nums mt-1">{brl(vendido)}</p></div>
          <div style={{ borderLeft: "1px solid rgba(255,255,255,.1)", paddingLeft: 24 }}><p className="text-[9px] font-mono text-muted-foreground/70 tracking-[0.1em] uppercase">Vendas</p><p className="font-black text-[17px] font-mono tabular-nums mt-1">{vendas.length}</p></div>
          <div style={{ borderLeft: "1px solid rgba(255,255,255,.1)", paddingLeft: 24 }}><p className="text-[9px] font-mono text-muted-foreground/70 tracking-[0.1em] uppercase">Abord.</p><p className="font-black text-[17px] font-mono tabular-nums mt-1">{abordagens}</p></div>
        </div>

        {/* Estoque NÃO aparece durante o corre (pedido do Rick, 01/09):
            o DEFCON é só relógio e ação. Unidades e o que sobrou só no fechamento. */}

        {/* VENDA RÁPIDA — valor que ele registrou 2 vezes no dia vira botão fixo
            até o fim do dia. Um toque = mesma venda, mesmo método. */}
        {rapidos.length > 0 && (
          <div className="mt-7 text-center">
            <p className="text-[10px] font-mono text-muted-foreground/70 tracking-[0.3em] uppercase">Venda rápida</p>
            <div className="flex justify-center gap-3 mt-2.5 flex-wrap">
              {rapidos.map((r) => (
                <button key={r.valor} onClick={() => registrarDireto(r.valor, r.metodo)}
                  className="h-12 px-5 rounded-2xl border-2 font-black text-[16px] orbis-num active:scale-95 transition"
                  style={{ borderColor: "rgba(245,184,0,.45)", color: "var(--orbis-fg)", background: "rgba(245,184,0,.05)" }}>
                  + {brl(r.valor)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="w-full flex justify-center mt-6">
          <button className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-full bg-card border border-border">
            <Minus className="w-3.5 h-3.5 text-destructive" strokeWidth={2.5} />
            <span className="text-xs font-bold text-foreground/70 tracking-wide uppercase">Custo</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 mt-6 px-1">
          <button onClick={() => setAbordagens((a) => a + 1)} className="flex-1 h-[56px] rounded-2xl bg-card border border-border flex flex-col items-center justify-center gap-0.5 active:scale-95 transition">
            <UserRound className="w-4 h-4" strokeWidth={2.5} /><span className="text-xs font-bold leading-none">Abordagem</span>
          </button>
          <button onClick={() => setFolha(true)} className="flex-[1.25] h-[72px] rounded-2xl bg-primary flex items-center justify-center gap-2 active:scale-95 transition"
            style={{ boxShadow: "0 12px 40px -6px hsl(var(--primary)/0.85)" }}>
            <Plus className="w-7 h-7 text-primary-foreground" strokeWidth={3.5} /><span className="text-[18px] font-black text-primary-foreground tracking-tight">Venda</span>
          </button>
          <button className="flex-1 h-[56px] rounded-2xl bg-transparent border-2 border-primary/40 flex flex-col items-center justify-center gap-0.5">
            <Coins className="w-4 h-4 text-primary" strokeWidth={2.5} /><span className="text-xs font-bold text-primary leading-none">Gorjeta</span>
          </button>
        </div>

        <p className="text-[13px] text-foreground/70 font-mono text-center font-semibold mt-6">Sem ação, sem dinheiro.</p>

        <div className="flex items-center justify-between gap-2 mt-6 px-2">
          <button className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5"><FileText className="w-3 h-3 text-muted-foreground/60" /><span className="text-xs font-mono text-muted-foreground/70 tracking-wider uppercase">Ocorrência</span></button>
          <span className="text-foreground/10">|</span>
          <button className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5"><UtensilsCrossed className="w-3 h-3 text-muted-foreground/60" /><span className="text-xs font-mono text-muted-foreground/70 tracking-wider uppercase">Pausar</span></button>
          <span className="text-foreground/10">|</span>
          <button onClick={() => setPasso("custos")} className="flex-1 h-9 rounded-lg flex items-center justify-center"><span className="text-xs font-mono text-destructive/80 tracking-wider uppercase font-bold">Encerrar</span></button>
        </div>

        {/* folha de venda — o único lugar que mudou */}
        {folha && (
          <div className="fixed inset-0 z-[70] flex items-end justify-center" style={{ background: "rgba(0,0,0,.90)" }} role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-t-[26px] border-t p-5 pb-8" style={{ background: "var(--orbis-surface)", borderColor: "rgba(255,255,255,.12)" }}>
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold">Registrar venda</p>
                <button onClick={() => { setFolha(false); setValor(""); setQtdManual(null); }}><X className="w-6 h-6 text-muted-foreground" /></button>
              </div>

              <div className="rounded-[16px] border mt-4 h-[64px] flex items-center px-4 gap-2" style={{ borderColor: "rgba(245,184,0,.35)", background: "rgba(245,184,0,.06)" }}>
                <span className="text-[19px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>R$</span>
                <input autoFocus inputMode="decimal" value={valor} onChange={(e) => { setValor(e.target.value); setQtdManual(null); }} placeholder="0,00"
                  className="orbis-num flex-1 bg-transparent outline-none text-[30px] font-extrabold" style={{ color: "var(--orbis-fg)" }} />
              </div>

              {temCarga && valorNum > 0 && casado && (
                <div className="rounded-[14px] border mt-3 p-3.5 flex items-center gap-3" style={{ borderColor: "rgba(61,214,140,.30)", background: "rgba(61,214,140,.07)" }}>
                  <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(61,214,140,.16)" }}><Check className="w-4 h-4" style={{ color: "var(--orbis-ok)" }} strokeWidth={2.8} /></span>
                  <span className="flex-1">
                    <b className="block text-[14px] font-semibold">{casado.unidades} × {prods.find((p) => p.id === casado.prodId)?.nome}</b>
                    <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-2)" }}>Está na sua tabela · sai {casado.unidades} do estoque</small>
                  </span>
                </div>
              )}

              {temCarga && valorNum > 0 && !casado && (
                <div className="rounded-[14px] border mt-3 p-3.5" style={{ borderColor: "rgba(245,184,0,.30)", background: "rgba(245,184,0,.06)" }}>
                  <p className="text-[13.5px] font-semibold">Quantas unidades saíram?</p>
                  <div className="flex gap-2 mt-2.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setQtdManual(n)} className="w-11 h-10 rounded-[10px] text-[15px] font-extrabold"
                        style={qtdManual === n ? { background: "var(--orbis-gold)", color: "#1A1200" } : { border: "1px solid rgba(245,184,0,.3)", color: "var(--orbis-gold)" }}>{n}</button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                {[["dinheiro", "DINHEIRO", "hsl(var(--success))"], ["pix", "PIX", "hsl(var(--primary))"], ["cartao", "CARTÃO", "hsl(var(--foreground))"]].map(([k, rot, bg]) => (
                  <button key={k as string} disabled={!(valorNum > 0) || (temCarga && !casado && !qtdManual)} onClick={() => registrar(k as string)}
                    className="flex-1 h-16 rounded-xl font-black text-sm disabled:opacity-30 active:scale-95 transition"
                    style={{ background: bg as string, color: k === "cartao" ? "hsl(var(--background))" : "#111" }}>{rot as string}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ============ 5 · CUSTOS ============ */
  if (passo === "custos") {
    const unidades = vendas.reduce((s, v) => s + v.unidades, 0);
    return (
      <div className="orbis-stagger max-w-2xl mx-auto pb-10">
        <Faixa>Fechamento de teste.</Faixa>
        <p className="orbis-section">fechamento</p>
        <h1 className="font-display text-[21px] font-extrabold mt-1 leading-tight">Vendeu {brl0(vendido)}.<br />Quanto sobrou pra você?</h1>

        <div className="rounded-[20px] border mt-4 px-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surface)" }}>
          {temCarga && (
            <div className="flex items-center gap-3 py-3.5">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.05)" }}><Package className="w-[17px] h-[17px]" style={{ color: "var(--orbis-ok)" }} /></span>
              <span className="flex-1 min-w-0">
                <b className="block text-[14px] font-semibold">Mercadoria <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[.06em]" style={{ background: "rgba(61,214,140,.13)", color: "var(--orbis-ok)" }}>automático</span></b>
                <small className="block text-[11.5px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>{unidades} unidades vendidas × custo do catálogo</small>
              </span>
              <span className="rounded-full px-3 py-1.5 text-[12.5px] font-bold orbis-num shrink-0" style={{ background: "rgba(61,214,140,.10)", border: "1px solid rgba(61,214,140,.35)", color: "var(--orbis-ok)" }}>{brl0(cmv)}</span>
            </div>
          )}
          {([["Transporte", Bus, transporte, setTransporte, 20], ["Comida", Utensils, comida, setComida, 25]] as const).map(([rot, Icone, val, setVal, sug], i) => (
            <div key={rot} className="flex items-center gap-3 py-3.5" style={(i > 0 || temCarga) ? { borderTop: "1px solid rgba(255,255,255,.07)" } : undefined}>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.05)" }}><Icone className="w-[17px] h-[17px]" style={{ color: "var(--orbis-fg-2)" }} /></span>
              <span className="flex-1 min-w-0">
                <b className="block text-[14px] font-semibold">{rot}</b>
                <small className="block text-[11.5px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>Ontem você gastou {brl0(sug)}</small>
              </span>
              <button onClick={() => setVal(val === sug ? 0 : sug)} className="rounded-full px-3 py-1.5 text-[12.5px] font-bold orbis-num shrink-0"
                style={val === sug ? { background: "var(--orbis-gold)", color: "#1A1200" } : { background: "rgba(245,184,0,.08)", border: "1px solid rgba(245,184,0,.35)", color: "var(--orbis-gold)" }}>{brl0(sug)}</button>
            </div>
          ))}
        </div>

        <button onClick={() => setPasso("resultado")} className="orbis-cta w-full mt-4">VER MEU LUCRO</button>
        <p className="text-[12px] text-center mt-3 leading-[1.55]" style={{ color: "var(--orbis-fg-3)" }}>
          Sem custo lançado, o lucro é chute.{temCarga && <><br />A mercadoria o Orbis já calcula sozinho pra você.</>}
        </p>
      </div>
    );
  }

  /* ============ 6 · RESULTADO ============ */
  if (passo === "resultado") {
    const bateu = vendido >= metaDia;
    return (
      <div className="orbis-stagger max-w-2xl mx-auto pb-10">
        <Faixa>Resultado de teste.</Faixa>
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[.08em]"
            style={{ border: `1px solid ${bateu ? "rgba(61,214,140,.35)" : "rgba(255,255,255,.14)"}`, background: bateu ? "rgba(61,214,140,.10)" : "rgba(255,255,255,.04)", color: bateu ? "var(--orbis-ok)" : "var(--orbis-fg-2)" }}>
            {bateu ? <><Check className="w-3 h-3" strokeWidth={3} /> Meta batida · {Math.round(pct)}%</> : <>Dia encerrado · {Math.round(pct)}% da meta</>}
          </span>
        </div>
        <div className="orbis-card-in rounded-[22px] border mt-3 p-5 text-center"
          style={{ borderColor: bateu ? "rgba(61,214,140,.28)" : "rgba(245,184,0,.24)", background: bateu ? "linear-gradient(165deg,#0d1a12 0%,var(--orbis-surface) 55%)" : "linear-gradient(165deg,#181307 0%,var(--orbis-surface) 55%)" }}>
          <p className="orbis-label" style={{ color: bateu ? "var(--orbis-ok)" : "var(--orbis-gold)" }}>Sobrou pra você</p>
          <p className="orbis-num text-[38px] font-extrabold mt-2 leading-none">{brl(lucro)}</p>
          <div className="flex mt-4 pt-3.5" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <div className="flex-1 text-left"><p className="text-[10.5px] font-semibold uppercase tracking-[.06em]" style={{ color: "var(--orbis-fg-3)" }}>Vendido</p><p className="orbis-num text-[16px] font-extrabold mt-1">{brl0(vendido)}</p></div>
            <div className="flex-1 text-left pl-3" style={{ borderLeft: "1px solid rgba(255,255,255,.08)" }}><p className="text-[10.5px] font-semibold uppercase tracking-[.06em]" style={{ color: "var(--orbis-fg-3)" }}>Custos</p><p className="orbis-num text-[16px] font-extrabold mt-1" style={{ color: "var(--orbis-custo)" }}>{brl0(custosTotal)}</p></div>
            <div className="flex-1 text-left pl-3" style={{ borderLeft: "1px solid rgba(255,255,255,.08)" }}><p className="text-[10.5px] font-semibold uppercase tracking-[.06em]" style={{ color: "var(--orbis-fg-3)" }}>Margem</p><p className="orbis-num text-[16px] font-extrabold mt-1" style={{ color: "var(--orbis-ok)" }}>{Math.round(margem)}%</p></div>
          </div>
        </div>
        <div className="rounded-[18px] border mt-3 p-4 flex items-center gap-3" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surface)" }}>
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.12)" }}><TrendingUp className="w-[17px] h-[17px]" style={{ color: "var(--orbis-gold)" }} /></span>
          <span className="flex-1">
            <b className="block text-[14px] font-semibold">{vendas.length} vendas · {vendas.reduce((s, v) => s + v.unidades, 0)} unidades</b>
            <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-2)" }}>Ticket médio {brl(vendas.length ? vendido / vendas.length : 0)}</small>
          </span>
        </div>
        <button onClick={() => setPasso("pontes")} className="orbis-cta w-full mt-4">VER O QUE ISSO MEXEU</button>
      </div>
    );
  }

  /* ============ 7 · PONTES + ESTOQUE ============ */
  return (
    <div className="orbis-stagger max-w-2xl mx-auto pb-10">
      <Faixa>Pontes de teste.</Faixa>
      <p className="orbis-section">fechamento</p>
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
          <span className="flex-1"><b className="block text-[14px] font-semibold">{t}</b><small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-2)" }}>{s}</small></span>
        </div>
      ))}

      {temCarga && (
        <>
          <p className="orbis-section mt-5">Seu estoque depois de hoje</p>
          <div className="rounded-[20px] border mt-2 p-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surface)" }}>
            {prods.filter((p) => p.levar > 0).map((p) => {
              const voltou = Math.max(0, p.levar - p.vendido);
              const restamCasa = p.estoque - p.vendido;
              const pr = p.estoque > 0 ? (restamCasa / p.estoque) * 100 : 0;
              const acabando = pr < 30;
              return (
                <div key={p.id} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13.5px] font-semibold">{p.nome}</span>
                    <span className="orbis-num text-[14px] font-bold" style={{ color: acabando ? "var(--orbis-custo)" : "var(--orbis-ok)" }}>Restam {restamCasa}</span>
                  </div>
                  <small className="block text-[11.5px]" style={{ color: "var(--orbis-fg-3)" }}>Levou {p.levar} · vendeu {p.vendido} · voltou {voltou}</small>
                  <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,.09)" }}>
                    <i className="block h-full rounded-full" style={{ width: `${Math.max(3, pr)}%`, background: acabando ? "var(--orbis-custo)" : "var(--orbis-ok)" }} />
                  </div>
                </div>
              );
            })}
          </div>
          {prods.some((p) => p.levar > 0 && (p.estoque - p.vendido) / p.estoque < 0.3) && (
            <div className="rounded-[16px] border mt-3 p-3.5 flex items-center gap-3" style={{ borderColor: "rgba(229,115,127,.35)", background: "rgba(229,115,127,.07)" }}>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(180deg,#F08F99,#E5737F)", boxShadow: "0 3px 0 #8E3A42" }}>
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
        </>
      )}

      <div className="rounded-[18px] border mt-4 p-4" style={{ borderColor: "rgba(245,184,0,.24)", background: "linear-gradient(165deg,#181307 0%,var(--orbis-surface) 55%)" }}>
        <p className="orbis-section">Amanhã</p>
        <p className="text-[13px] mt-1.5" style={{ color: "var(--orbis-fg-2)" }}>Você começa às <b style={{ color: "var(--orbis-fg)" }}>7h</b> · meta de <b style={{ color: "var(--orbis-fg)" }}>{brl0(metaDia)}</b></p>
        <p className="text-[12.5px] mt-1.5" style={{ color: "var(--orbis-fg-3)" }}>Mantendo o ritmo de hoje, fecha o mês em <b style={{ color: "var(--orbis-gold)" }}>{brl0(vendido * 26)}</b></p>
      </div>

      <button onClick={zerar} className="w-full h-12 rounded-[15px] mt-4 text-[14px] font-bold inline-flex items-center justify-center gap-2"
        style={{ background: "rgba(245,184,0,.10)", border: "1px solid rgba(245,184,0,.3)", color: "var(--orbis-gold)" }}>
        <RotateCcw className="w-4 h-4" /> Rodar o teste de novo
      </button>
      <button onClick={() => navigate("/admin")} className="w-full h-10 mt-2 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ color: "var(--orbis-fg-3)" }}>
        <ArrowLeft className="w-3.5 h-3.5" /> voltar pro painel
      </button>
    </div>
  );
}
