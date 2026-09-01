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
  CreditCard, Smartphone, Banknote, Trash2, Clock, ChevronRight, AlertTriangle, Zap,
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

/* O fechamento aprovado no mockup tem 5 telas, não 3:
   encerrar (modal) → recebimentos → custos editáveis → relatório premium
   → o que esse dia mexeu → volta pro Foco com o dia encerrado. */
type Passo = "inicio" | "desafio" | "carga" | "cadastro" | "rodando" | "fechamento" | "custos" | "relatorio" | "mexeu" | "foco";
interface CustoLinha { id: string; nome: string; sub: string; valor: number; auto?: boolean }

export default function TesteDefcon() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { whitelisted, role, loading: adminLoading } = useAdminAccess(user?.id);
  const isAdmin = whitelisted && role === "admin";

  const [passo, setPasso] = useState<Passo>("inicio");   // começa na aba Foco, como no app
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

  /* --- fechamento (telas novas) --- */
  const [confirmarFim, setConfirmarFim] = useState(false);
  const [rec, setRec] = useState({ dinheiro: "", pix: "", cartao: "" });
  const [linhas, setLinhas] = useState<CustoLinha[] | null>(null);   // null = ainda não montou
  const [novoCusto, setNovoCusto] = useState<{ nome: string; valor: string } | null>(null);

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
    setPasso("inicio"); setProds(CATALOGO); setVendas([]); setValor(""); setQtdManual(null);
    setRec({ dinheiro: "", pix: "", cartao: "" }); setLinhas(null); setNovoCusto(null); setConfirmarFim(false);
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

  /* ============ 1 · ABA FOCO — o dia não começou ============ */
  if (passo === "inicio") {
    return (
      <div className="px-1 pt-2 pb-10 max-w-md mx-auto orbis-stagger">
        <Faixa>Você está na aba Foco do teste. Nada aqui vai pro banco.</Faixa>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="orbis-mini">{new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").toUpperCase()}</p>
            <h1 className="font-display text-[22px] font-extrabold mt-1">Seu dia</h1>
          </div>
          <span className="w-[54px] h-[54px] rounded-full shrink-0 flex items-center justify-center"
            style={{ border: "6px solid rgba(255,255,255,.07)" }}>
            <span className="orbis-num text-[12.5px] font-bold" style={{ color: "var(--orbis-fg-3)" }}>0%</span>
          </span>
        </div>

        <div className="rounded-[24px] border mt-4 p-5" style={{ borderColor: "rgba(229,115,127,.26)", background: "linear-gradient(165deg,#1A0D0F 0%,#101010 58%)", boxShadow: "0 24px 54px -32px rgba(229,115,127,.4)" }}>
          <p className="orbis-mini" style={{ color: "var(--orbis-gold)" }}>Meta do dia</p>
          <p className="orbis-num mt-2.5 whitespace-nowrap" style={{ fontSize: "clamp(30px,8.8vw,38px)", fontWeight: 700, letterSpacing: "-.025em" }}>
            {brl0(metaDia)}<span style={{ fontSize: ".4em", color: "var(--orbis-fg-3)", fontWeight: 700 }}>,00</span>
          </p>
          <p className="text-[12px] mt-2.5" style={{ color: "var(--orbis-fg-2)" }}>Ainda não começou · <b style={{ color: "var(--orbis-fg)" }}>10 blocos de 1h</b></p>

          <div className="flex mt-[18px] pt-[18px]" style={{ borderTop: "1px solid var(--orbis-line)" }}>
            <div className="flex-1"><p className="orbis-mini">Vendido</p><p className="orbis-num text-[18px] font-bold mt-1.5">{brl(0)}</p></div>
            <div className="flex-1 pl-4" style={{ borderLeft: "1px solid var(--orbis-line)" }}><p className="orbis-mini">Falta</p><p className="orbis-num text-[18px] font-bold mt-1.5">{brl0(metaDia)}</p></div>
          </div>

          {/* vermelho absoluto (pedido do Rick) */}
          <button onClick={() => setPasso("desafio")}
            className="w-full h-[54px] rounded-[16px] mt-[18px] font-extrabold text-[15.5px] inline-flex items-center justify-center gap-2 active:scale-[.98] transition"
            style={{ background: "#E5354A", color: "#FFF", boxShadow: "0 10px 26px -10px rgba(229,53,74,.85)" }}>
            <Zap className="w-[18px] h-[18px]" strokeWidth={2.8} /> INICIAR DEFCON 4
          </button>
        </div>

        <p className="orbis-section mt-6 px-1">Enquanto isso</p>
        <div className="rounded-[20px] border mt-3 overflow-hidden" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
          {([["Lançar um custo", "mercadoria, transporte", <ShoppingCart className="w-[17px] h-[17px]" strokeWidth={2.1} key="a" />],
             ["Pix que caiu depois", "lança no dia da venda", <Smartphone className="w-[17px] h-[17px]" strokeWidth={2.1} key="b" />]] as [string, string, JSX.Element][])
            .map(([t, sub, ico], idx) => (
              <div key={t} className="flex items-center gap-3 px-4 h-[62px]" style={idx ? { borderTop: "1px solid var(--orbis-line)" } : undefined}>
                <span className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.09)", color: "var(--orbis-gold)" }}>{ico}</span>
                <span className="flex-1 min-w-0">
                  <b className="block text-[14px] font-semibold truncate">{t}</b>
                  <small className="block text-[11.5px] truncate" style={{ color: "var(--orbis-fg-3)" }}>{sub}</small>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--orbis-fg-3)" }} />
              </div>
            ))}
        </div>

        <button onClick={() => navigate("/admin")} className="w-full h-10 mt-6 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ color: "var(--orbis-fg-3)" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> voltar pro painel
        </button>
      </div>
    );
  }

  /* ============ 2 · MODO DESAFIO (a tela que já existe) ============ */
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
          {/* CONV. — o DEFCON real tem esta coluna; o protótipo estava sem (Rick, 01/09).
             Conversão = vendas ÷ abordagens. Como toda venda também conta abordagem,
             o número nunca passa de 100%. */}
          <div style={{ borderLeft: "1px solid rgba(255,255,255,.1)", paddingLeft: 24 }}><p className="text-[9px] font-mono text-muted-foreground/70 tracking-[0.1em] uppercase">Conv.</p><p className="font-black text-primary text-[17px] font-mono tabular-nums mt-1">{abordagens > 0 ? Math.round((vendas.length / abordagens) * 100) : 0}%</p></div>
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

        {/* Igual ao DEFCON real: quando já há um ticket médio, a frase vira conta. */}
        {vendas.length > 0 && falta > 0 ? (
          <p className="text-[13px] text-foreground/70 font-mono text-center font-semibold mt-6">
            Faltam {Math.ceil(falta / (vendido / vendas.length))} vendas de {brl(vendido / vendas.length)}
          </p>
        ) : (
          <p className="text-[13px] text-foreground/70 font-mono text-center font-semibold mt-6">Sem ação, sem dinheiro.</p>
        )}

        <div className="flex items-center justify-between gap-2 mt-6 px-2">
          <button className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5"><FileText className="w-3 h-3 text-muted-foreground/60" /><span className="text-xs font-mono text-muted-foreground/70 tracking-wider uppercase">Ocorrência</span></button>
          <span className="text-foreground/10">|</span>
          <button className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5"><UtensilsCrossed className="w-3 h-3 text-muted-foreground/60" /><span className="text-xs font-mono text-muted-foreground/70 tracking-wider uppercase">Pausar</span></button>
          <span className="text-foreground/10">|</span>
          <button onClick={() => setConfirmarFim(true)} className="flex-1 h-9 rounded-lg flex items-center justify-center"><span className="text-xs font-mono text-destructive/80 tracking-wider uppercase font-bold">Encerrar</span></button>
        </div>

        {/* rodapé do DEFCON real */}
        <p className="text-center text-[11px] font-mono tracking-[0.18em] uppercase mt-4" style={{ color: "var(--orbis-fg-3)" }}>
          Bloco 1/10 · <span style={{ color: "var(--orbis-gold)" }}>ver blocos ›</span>
        </p>

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
        {/* ---- 6 · ENCERRAR O DIA (confirmação) ---- */}
        {confirmarFim && (
          <div className="fixed inset-0 z-[80] flex items-end justify-center px-4 pb-8" style={{ background: "rgba(0,0,0,.86)" }} role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-[24px] border p-6" style={{ background: "var(--orbis-surface)", borderColor: "rgba(255,255,255,.12)" }}>
              <p className="font-display text-[19px] font-extrabold text-center">Encerrar o desafio?</p>
              <p className="text-[13px] text-center mt-2 leading-relaxed" style={{ color: "var(--orbis-fg-2)" }}>
                Você fecha o dia e vê seu relatório completo. Dá pra reabrir depois.
              </p>
              <button onClick={() => { setConfirmarFim(false); setPasso("fechamento"); }}
                className="w-full h-[52px] rounded-[16px] mt-5 font-extrabold text-[15px] active:scale-[.98] transition"
                style={{ background: "#E5737F", color: "#1A0A0C" }}>SIM, ENCERRAR</button>
              <button onClick={() => setConfirmarFim(false)} className="w-full h-11 mt-2 text-[13.5px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>Voltar</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---------- números do fechamento ---------- */
  const nnum = (t: string) => Number(String(t).replace(/\./g, "").replace(",", ".")) || 0;
  const recDin = nnum(rec.dinheiro), recPix = nnum(rec.pix), recCar = nnum(rec.cartao);
  const recebido = recDin + recPix + recCar;
  const fiado = Math.max(0, Math.round((vendido - recebido) * 100) / 100);
  const semear = (): CustoLinha[] => [
    { id: "mercadoria", nome: "Mercadoria", sub: "automático · o que saiu do estoque", valor: Math.round(cmv * 100) / 100, auto: true },
    { id: "transporte", nome: "Transporte", sub: "ontem: R$ 20", valor: 0 },
    { id: "comida", nome: "Comida", sub: "ontem: R$ 25", valor: 0 },
  ];
  const linhasCusto = linhas ?? semear();
  const custoFinal = linhasCusto.reduce((t, l) => t + l.valor, 0);
  const lucroFinal = vendido - custoFinal;
  const margemFinal = vendido > 0 ? (lucroFinal / vendido) * 100 : 0;
  const unidades = vendas.reduce((t, v) => t + v.unidades, 0);
  const ticket = vendas.length ? vendido / vendas.length : 0;
  const conversao = abordagens > 0 ? (vendas.length / abordagens) * 100 : 0;
  const minutosRua = inicio ? Math.max(1, Math.round((agora - inicio.getTime()) / 60000)) : 0;
  const naRua = `${Math.floor(minutosRua / 60)}h${String(minutosRua % 60).padStart(2, "0")}`;
  const bateuMeta = vendido >= metaDia;
  const pctMeta = metaDia > 0 ? Math.round((vendido / metaDia) * 100) : 0;
  const setLinha = (id: string, v: number) => setLinhas(linhasCusto.map((l) => (l.id === id ? { ...l, valor: v } : l)));

  const Passos = ({ n }: { n: 1 | 2 }) => (
    <>
      <p className="orbis-mini">Fechamento · passo {n} de 3</p>
      <div className="flex gap-1.5 mt-3">
        {[1, 2, 3].map((k) => (
          <span key={k} className="h-[3px] flex-1 rounded-full" style={{ background: k <= n ? "var(--orbis-gold)" : "rgba(255,255,255,.10)" }} />
        ))}
      </div>
    </>
  );

  /* ============ 8 · FECHAMENTO — de onde o dinheiro veio ============ */
  if (passo === "fechamento") {
    const campos: [keyof typeof rec, string, JSX.Element][] = [
      ["dinheiro", "Dinheiro", <Banknote className="w-[17px] h-[17px]" strokeWidth={2.1} style={{ color: "var(--orbis-ok)" }} />],
      ["pix", "Pix", <Smartphone className="w-[17px] h-[17px]" strokeWidth={2.1} style={{ color: "var(--orbis-gold)" }} />],
      ["cartao", "Cartão", <CreditCard className="w-[17px] h-[17px]" strokeWidth={2.1} style={{ color: "var(--orbis-fg-2)" }} />],
    ];
    return (
      <div className="px-1 pt-2 pb-10 max-w-md mx-auto orbis-stagger">
        <Faixa>Fechamento de mentira — nada vai pro banco.</Faixa>
        <Passos n={1} />
        <h1 className="font-display text-[21px] font-extrabold leading-tight mt-4">Do que você vendeu,<br />quanto entrou?</h1>

        <div className="mt-5 rounded-[20px] border overflow-hidden" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
          {campos.map(([k, rot, ico], idx) => (
            <div key={k} className="flex items-center gap-3 px-4 h-[62px]" style={idx ? { borderTop: "1px solid var(--orbis-line)" } : undefined}>
              <span className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.05)" }}>{ico}</span>
              <span className="flex-1 text-[14.5px] font-semibold">{rot}</span>
              <span className="inline-flex items-center gap-1.5 rounded-[12px] px-3 h-[38px]"
                style={{ border: `1px solid ${rec[k] ? "rgba(245,184,0,.45)" : "rgba(255,255,255,.10)"}`, background: rec[k] ? "rgba(245,184,0,.06)" : "transparent" }}>
                <small className="text-[12px]" style={{ color: "var(--orbis-fg-3)" }}>R$</small>
                <input inputMode="decimal" value={rec[k]} placeholder="0,00"
                  onChange={(e) => setRec({ ...rec, [k]: e.target.value })}
                  className="orbis-num w-[74px] bg-transparent outline-none text-right text-[16px] font-bold" style={{ color: "var(--orbis-fg)" }} />
              </span>
            </div>
          ))}
        </div>

        {fiado > 0 && vendido > 0 && (
          <div className="rounded-[16px] border mt-3 p-3.5 flex items-start gap-3" style={{ borderColor: "rgba(229,115,127,.32)", background: "rgba(229,115,127,.08)" }}>
            <span className="w-7 h-7 rounded-[9px] flex items-center justify-center shrink-0" style={{ background: "rgba(229,115,127,.16)" }}>
              <AlertTriangle className="w-4 h-4" style={{ color: "var(--orbis-custo)" }} strokeWidth={2.4} />
            </span>
            <span className="flex-1 min-w-0">
              <b className="block text-[14px] font-semibold" style={{ color: "var(--orbis-custo)" }}>{brl(fiado)} ficaram de pagar</b>
              <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>Vendeu {brl(vendido)} · recebeu {brl(recebido)}</small>
            </span>
          </div>
        )}

        <button onClick={() => { setLinhas(semear()); setPasso("custos"); }} className="orbis-cta w-full mt-5">CONTINUAR</button>
        <p className="text-[11.5px] text-center mt-2.5" style={{ color: "var(--orbis-fg-3)" }}>O que faltar pro total o Orbis marca como fiado.</p>
        <button onClick={() => setPasso("rodando")} className="w-full h-10 mt-1 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ color: "var(--orbis-fg-3)" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> voltar pro DEFCON
        </button>
      </div>
    );
  }

  /* ============ 9 · CUSTOS — editáveis, nada obrigatório ============ */
  if (passo === "custos") {
    const icone = (id: string) =>
      id === "mercadoria" ? <ShoppingCart className="w-[17px] h-[17px]" strokeWidth={2.1} />
      : id === "transporte" ? <Bus className="w-[17px] h-[17px]" strokeWidth={2.1} />
      : id === "comida" ? <Utensils className="w-[17px] h-[17px]" strokeWidth={2.1} />
      : <Package className="w-[17px] h-[17px]" strokeWidth={2.1} />;
    return (
      <div className="px-1 pt-2 pb-10 max-w-md mx-auto orbis-stagger">
        <Faixa>Custos de mentira — nada vai pro banco.</Faixa>
        <Passos n={2} />
        <h1 className="font-display text-[21px] font-extrabold leading-tight mt-4">Os custos que eu já sei<br />são estes. Teve mais algum?</h1>

        <div className="mt-5 rounded-[20px] border overflow-hidden" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
          {linhasCusto.map((l, idx) => (
            <div key={l.id} className="flex items-center gap-3 px-4 h-[64px]" style={idx ? { borderTop: "1px solid var(--orbis-line)" } : undefined}>
              <span className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.09)", color: "var(--orbis-gold)" }}>{icone(l.id)}</span>
              <span className="flex-1 min-w-0">
                <b className="block text-[14.5px] font-semibold truncate">{l.nome}</b>
                <small className="block text-[11.5px] truncate" style={{ color: l.auto ? "var(--orbis-ok)" : "var(--orbis-fg-3)" }}>{l.sub}</small>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-[12px] px-3 h-[38px] shrink-0"
                style={{ border: `1px solid ${l.valor > 0 ? "rgba(245,184,0,.45)" : "rgba(255,255,255,.10)"}`, background: l.valor > 0 ? "rgba(245,184,0,.06)" : "transparent" }}>
                <small className="text-[12px]" style={{ color: "var(--orbis-fg-3)" }}>R$</small>
                <input inputMode="decimal" value={l.valor ? String(l.valor).replace(".", ",") : ""} placeholder="0,00"
                  onChange={(e) => setLinha(l.id, nnum(e.target.value))}
                  className="orbis-num w-[70px] bg-transparent outline-none text-right text-[16px] font-bold" style={{ color: "var(--orbis-fg)" }} />
              </span>
              {!l.auto && (
                <button onClick={() => setLinhas(linhasCusto.filter((x) => x.id !== l.id))} aria-label={`Remover ${l.nome}`} className="shrink-0 p-1">
                  <Trash2 className="w-4 h-4" style={{ color: "var(--orbis-fg-3)" }} />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between px-4 h-[52px]" style={{ borderTop: "1px solid var(--orbis-line)", background: "rgba(0,0,0,.25)" }}>
            <span className="orbis-mini">Total de custos</span>
            <span className="orbis-num text-[17px] font-extrabold" style={{ color: custoFinal > 0 ? "var(--orbis-custo)" : "var(--orbis-fg-3)" }}>{brl(custoFinal)}</span>
          </div>
        </div>

        {novoCusto ? (
          <div className="rounded-[16px] border mt-3 p-3.5" style={{ borderColor: "rgba(245,184,0,.3)", background: "rgba(245,184,0,.05)" }}>
            <input autoFocus value={novoCusto.nome} onChange={(e) => setNovoCusto({ ...novoCusto, nome: e.target.value })} placeholder="Do que foi esse custo?"
              className="w-full bg-transparent outline-none text-[14.5px] font-semibold" />
            <div className="flex gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 rounded-[12px] px-3 h-[40px] flex-1" style={{ border: "1px solid rgba(255,255,255,.12)" }}>
                <small className="text-[12px]" style={{ color: "var(--orbis-fg-3)" }}>R$</small>
                <input inputMode="decimal" value={novoCusto.valor} onChange={(e) => setNovoCusto({ ...novoCusto, valor: e.target.value })} placeholder="0,00"
                  className="orbis-num flex-1 bg-transparent outline-none text-[16px] font-bold" />
              </span>
              <button onClick={() => {
                  const v = nnum(novoCusto.valor);
                  if (v > 0) setLinhas([...linhasCusto, { id: `x${Date.now()}`, nome: novoCusto.nome.trim() || "Outro custo", sub: "você adicionou", valor: v }]);
                  setNovoCusto(null);
                }}
                className="h-[40px] px-4 rounded-[12px] font-bold text-[13.5px]" style={{ background: "var(--orbis-gold)", color: "#1A1200" }}>ADICIONAR</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setNovoCusto({ nome: "", valor: "" })}
            className="w-full h-[46px] rounded-[14px] mt-3 text-[13.5px] font-semibold inline-flex items-center justify-center gap-1.5"
            style={{ border: "1px dashed rgba(245,184,0,.35)", color: "var(--orbis-gold)" }}>
            <Plus className="w-4 h-4" /> adicionar outro custo
          </button>
        )}

        <button onClick={() => setPasso("relatorio")} className="orbis-cta w-full mt-5">VER MEU RELATÓRIO</button>
        <p className="text-[11.5px] text-center mt-2.5" style={{ color: "var(--orbis-fg-3)" }}>Deixou em R$ 0? Então não conta.</p>
      </div>
    );
  }

  /* ============ 10 · RELATÓRIO DO DIA (premium) ============ */
  if (passo === "relatorio") {
    const metodos: [string, number, string, JSX.Element][] = [
      ["Dinheiro", recDin, "var(--orbis-ok)", <Banknote className="w-4 h-4" strokeWidth={2.1} />],
      ["Pix", recPix, "var(--orbis-gold)", <Smartphone className="w-4 h-4" strokeWidth={2.1} />],
      ["Cartão", recCar, "var(--orbis-fg-2)", <CreditCard className="w-4 h-4" strokeWidth={2.1} />],
    ];
    return (
      <div className="px-1 pt-2 pb-10 max-w-md mx-auto orbis-stagger">
        <Faixa>Relatório de mentira — nada vai pro banco.</Faixa>
        <p className="orbis-mini">{new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").toUpperCase()} · {naRua} NA RUA</p>
        <h1 className="font-display text-[22px] font-extrabold mt-1">Relatório do dia</h1>

        {/* herói */}
        <div className="rounded-[24px] border mt-4 p-5" style={{ borderColor: bateuMeta ? "rgba(61,214,140,.32)" : "rgba(245,184,0,.24)", background: "linear-gradient(165deg,#191308 0%,#101010 58%)", boxShadow: "0 24px 54px -32px rgba(245,184,0,.4)" }}>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 h-[24px] text-[10.5px] font-extrabold tracking-[.1em] uppercase"
            style={bateuMeta ? { background: "rgba(61,214,140,.14)", color: "var(--orbis-ok)", border: "1px solid rgba(61,214,140,.3)" } : { background: "rgba(245,184,0,.12)", color: "var(--orbis-gold)", border: "1px solid rgba(245,184,0,.3)" }}>
            {bateuMeta ? <><Check className="w-3 h-3" strokeWidth={3} /> Meta batida · {pctMeta}%</> : <>{pctMeta}% da meta</>}
          </span>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex-1 min-w-0">
              <p className="orbis-mini">Sobrou pra você</p>
              <p className="orbis-num mt-2 whitespace-nowrap" style={{ fontSize: "clamp(30px,8.8vw,38px)", fontWeight: 700, letterSpacing: "-.025em", color: lucroFinal >= 0 ? "var(--orbis-fg)" : "var(--orbis-custo)" }}>{brl(lucroFinal)}</p>
              <p className="text-[12px] mt-2.5" style={{ color: "var(--orbis-fg-2)" }}>De <b style={{ color: "var(--orbis-fg)" }}>{brl0(vendido)}</b> vendidos · margem <b style={{ color: "var(--orbis-ok)" }}>{Math.round(margemFinal)}%</b></p>
            </div>
            <div className="w-[74px] h-[74px] rounded-full shrink-0 flex items-center justify-center"
              style={{ border: "7px solid rgba(255,255,255,.07)", boxShadow: bateuMeta ? "0 0 24px -4px rgba(61,214,140,.5), inset 0 0 0 3px rgba(61,214,140,.9)" : "inset 0 0 0 3px rgba(245,184,0,.9)" }}>
              <span className="orbis-num text-[14px] font-extrabold">{pctMeta}%</span>
            </div>
          </div>
          <div className="h-px my-[18px]" style={{ background: "var(--orbis-line)" }} />
          <div className="flex">
            <div className="flex-1"><p className="orbis-mini">Vendido</p><p className="orbis-num text-[16px] font-bold mt-1.5">{brl0(vendido)}</p></div>
            <div className="flex-1 pl-3" style={{ borderLeft: "1px solid var(--orbis-line)" }}><p className="orbis-mini">Recebido</p><p className="orbis-num text-[16px] font-bold mt-1.5" style={{ color: "var(--orbis-ok)" }}>{brl0(recebido)}</p></div>
            <div className="flex-1 pl-3" style={{ borderLeft: "1px solid var(--orbis-line)" }}><p className="orbis-mini">Fiado</p><p className="orbis-num text-[16px] font-bold mt-1.5" style={{ color: fiado > 0 ? "var(--orbis-custo)" : "var(--orbis-fg-3)" }}>{brl0(fiado)}</p></div>
          </div>
        </div>

        {/* como o dinheiro entrou */}
        <p className="orbis-section mt-6 px-1">Como o dinheiro entrou</p>
        <div className="rounded-[20px] border mt-3 overflow-hidden" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
          {metodos.map(([nome, v, cor, ico], idx) => (
            <div key={nome} className="px-4 py-3.5" style={idx ? { borderTop: "1px solid var(--orbis-line)" } : undefined}>
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.05)", color: cor }}>{ico}</span>
                <span className="flex-1 text-[14px] font-semibold">{nome}</span>
                <span className="orbis-num text-[15px] font-bold" style={{ color: v > 0 ? cor : "var(--orbis-fg-3)" }}>{brl0(v)}</span>
                <span className="orbis-num text-[11.5px] w-[34px] text-right" style={{ color: "var(--orbis-fg-3)" }}>{recebido > 0 ? Math.round((v / recebido) * 100) : 0}%</span>
              </div>
              <span className="block h-[3px] rounded-full mt-2.5" style={{ background: "rgba(255,255,255,.07)" }}>
                <span className="block h-full rounded-full" style={{ width: `${recebido > 0 ? (v / recebido) * 100 : 0}%`, background: cor }} />
              </span>
            </div>
          ))}
        </div>

        {/* o seu dia */}
        <p className="orbis-section mt-6 px-1">O seu dia</p>
        <div className="rounded-[20px] border mt-3 p-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
          <div className="grid grid-cols-3 gap-y-4">
            {([["Na rua", naRua, ""], ["Vendas", String(vendas.length), ""], ["Unidades", String(unidades), ""],
               ["Ticket", brl0(ticket), ""], ["Abord.", String(abordagens), ""], ["Conv.", `${Math.round(conversao)}%`, "var(--orbis-gold)"]] as [string, string, string][])
              .map(([rot, val, cor]) => (
                <div key={rot} className="text-center">
                  <p className="orbis-mini">{rot}</p>
                  <p className="orbis-num text-[17px] font-bold mt-1.5" style={cor ? { color: cor } : undefined}>{val}</p>
                </div>
              ))}
          </div>
        </div>

        <div className="rounded-[16px] border mt-3 p-3.5 flex items-center gap-3" style={{ borderColor: "rgba(245,184,0,.24)", background: "rgba(245,184,0,.05)" }}>
          <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.12)", color: "var(--orbis-gold)" }}><Clock className="w-4 h-4" strokeWidth={2.2} /></span>
          <span className="flex-1 min-w-0">
            <b className="block text-[13.5px] font-semibold">Sua melhor hora: {inicio ? `${hhmm(inicio)} → ${hhmm(new Date(inicio.getTime() + 3600_000))}` : "—"}</b>
            <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>{brl0(vendido)} num bloco só</small>
          </span>
        </div>

        <button onClick={() => setPasso("mexeu")} className="orbis-cta w-full mt-5">VER O QUE ISSO MEXEU</button>
      </div>
    );
  }

  /* ============ 11 · O QUE ESSE DIA MEXEU ============ */
  if (passo === "mexeu") {
    const clientesFiado = fiado > 0 ? Math.max(1, Math.round(fiado / Math.max(1, ticket))) : 0;
    return (
      <div className="px-1 pt-2 pb-10 max-w-md mx-auto orbis-stagger">
        <Faixa>Nada disso mexeu no ranking de verdade.</Faixa>
        <p className="orbis-mini">{new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").toUpperCase()}</p>
        <h1 className="font-display text-[21px] font-extrabold leading-tight mt-1">O que esse dia<br />mexeu no seu jogo</h1>

        <div className="rounded-[20px] border mt-4 p-4" style={{ borderColor: "rgba(245,184,0,.3)", background: "linear-gradient(120deg,rgba(70,52,10,.5),#0d0d0d)" }}>
          <div className="flex items-center gap-3.5">
            <span className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.14)", color: "var(--orbis-gold)" }}><Trophy className="w-6 h-6" strokeWidth={2} /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[10.5px] font-extrabold tracking-[.13em] uppercase" style={{ color: "var(--orbis-gold)" }}>Ranking do mês</span>
              <b className="block text-[15.5px] font-semibold mt-1">Subiu 2 lugares — é o #3</b>
              <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>Liga Bronze · 59 vendedores</small>
            </span>
          </div>
          <div className="flex items-center justify-between mt-3.5 pt-3.5" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <span className="text-[12.5px]" style={{ color: "var(--orbis-fg-2)" }}>Faltam <b style={{ color: "var(--orbis-gold)" }}>{brl0(210)}</b> pro segundo</span>
            <span className="text-[12.5px] font-semibold inline-flex items-center gap-0.5" style={{ color: "var(--orbis-fg-3)" }}>Ver <ChevronRight className="w-3.5 h-3.5" /></span>
          </div>
        </div>

        {fiado > 0 && (
          <div className="rounded-[20px] border mt-3 p-4" style={{ borderColor: "rgba(229,115,127,.3)", background: "rgba(229,115,127,.07)" }}>
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0" style={{ background: "rgba(229,115,127,.16)" }}><Coins className="w-[18px] h-[18px]" style={{ color: "var(--orbis-custo)" }} strokeWidth={2.2} /></span>
              <span className="flex-1 min-w-0">
                <b className="block text-[16px] font-bold" style={{ color: "var(--orbis-custo)" }}>{brl(fiado)}</b>
                <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>ficaram de pagar · {clientesFiado} cliente{clientesFiado > 1 ? "s" : ""}</small>
              </span>
            </div>
            <button className="w-full h-[46px] rounded-[14px] mt-3.5 font-bold text-[14px] inline-flex items-center justify-center gap-2" style={{ background: "#E5737F", color: "#1A0A0C" }}>
              <MessageCircle className="w-4 h-4" strokeWidth={2.4} /> COBRAR NO WHATSAPP
            </button>
          </div>
        )}

        <div className="rounded-[20px] border mt-3 p-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-[14.5px] font-semibold">
              <Flame className="w-[17px] h-[17px]" strokeWidth={2.3} style={{ color: "var(--orbis-gold)" }} /> 5 dias trabalhados
            </span>
            <span className="flex gap-[6px]">
              {["S", "T", "Q", "Q", "S", "S", "D"].map((l, i) => (
                <i key={i} className="w-[21px] h-[21px] rounded-full flex items-center justify-center text-[9.5px] font-bold not-italic"
                  style={i < 5 ? { background: "var(--orbis-gold)", color: "#1A1200" } : { border: "1.5px solid rgba(255,255,255,.13)", color: "var(--orbis-fg-3)" }}>{l}</i>
              ))}
            </span>
          </div>
          <p className="text-[12px] mt-2.5" style={{ color: "var(--orbis-fg-3)" }}>Amanhã é folga — a sequência não quebra.</p>
        </div>

        <button onClick={() => setPasso("relatorio")} className="w-full rounded-[18px] border mt-3 p-4 flex items-center gap-3 text-left" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
          <span className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.05)", color: "var(--orbis-fg-2)" }}><BarChart3 className="w-[18px] h-[18px]" strokeWidth={2.1} /></span>
          <span className="flex-1"><b className="block text-[14px] font-semibold">Ver este dia no relatório</b><small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>hora a hora</small></span>
          <ChevronRight className="w-4 h-4" style={{ color: "var(--orbis-fg-3)" }} />
        </button>

        <div className="rounded-[18px] border mt-3 p-4" style={{ borderColor: "rgba(245,184,0,.24)", background: "linear-gradient(165deg,#181307 0%,var(--orbis-surface) 55%)" }}>
          <p className="orbis-section">Amanhã</p>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-[13px]" style={{ color: "var(--orbis-fg-2)" }}>Começa às</span>
            <b className="orbis-num text-[14px]">7h00</b>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[13px]" style={{ color: "var(--orbis-fg-2)" }}>Meta</span>
            <b className="orbis-num text-[14px]">{brl0(metaDia)}</b>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2.5" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
            <span className="text-[13px]" style={{ color: "var(--orbis-fg-2)" }}>Nesse ritmo, o mês fecha em</span>
            <b className="orbis-num text-[14px]" style={{ color: "var(--orbis-gold)" }}>{brl0(vendido * 26)}</b>
          </div>
        </div>

        <button onClick={() => setPasso("foco")} className="orbis-cta w-full mt-5">FECHAR O DIA</button>
      </div>
    );
  }

  /* ============ 12 · VOLTA PRO FOCO — dia encerrado ============ */
  const acabando = prods.filter((p) => p.levar > 0 && p.estoque > 0 && (p.estoque - p.vendido) / p.estoque < 0.3);
  return (
    <div className="px-1 pt-2 pb-10 max-w-md mx-auto orbis-stagger">
      <Faixa>Fim do teste — nada foi gravado.</Faixa>
      <p className="orbis-mini">{new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").toUpperCase()}</p>
      <h1 className="font-display text-[22px] font-extrabold mt-1">Seu dia</h1>

      <div className="rounded-[24px] border mt-4 p-5" style={{ borderColor: "rgba(61,214,140,.3)", background: "linear-gradient(165deg,#0B1711 0%,#101010 58%)" }}>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 h-[24px] text-[10.5px] font-extrabold tracking-[.1em] uppercase"
          style={{ background: "rgba(61,214,140,.13)", color: "var(--orbis-ok)", border: "1px solid rgba(61,214,140,.3)" }}>
          <Check className="w-3 h-3" strokeWidth={3} /> Dia encerrado · {naRua} na rua
        </span>
        <p className="orbis-mini mt-4">Sobrou pra você</p>
        <p className="orbis-num mt-2 whitespace-nowrap" style={{ fontSize: "clamp(30px,8.8vw,38px)", fontWeight: 700, letterSpacing: "-.025em" }}>{brl(lucroFinal)}</p>
        <p className="text-[12px] mt-2.5" style={{ color: "var(--orbis-fg-2)" }}>Vendeu <b style={{ color: "var(--orbis-fg)" }}>{brl0(vendido)}</b> · meta era <b style={{ color: "var(--orbis-fg)" }}>{brl0(metaDia)}</b></p>

        <div className="flex mt-4 pt-4" style={{ borderTop: "1px solid var(--orbis-line)" }}>
          <div className="flex-1"><p className="orbis-mini">Recebido</p><p className="orbis-num text-[15px] font-bold mt-1.5" style={{ color: "var(--orbis-ok)" }}>{brl0(recebido)}</p></div>
          <div className="flex-1 pl-3" style={{ borderLeft: "1px solid var(--orbis-line)" }}><p className="orbis-mini">Fiado</p><p className="orbis-num text-[15px] font-bold mt-1.5" style={{ color: fiado > 0 ? "var(--orbis-custo)" : "var(--orbis-fg-3)" }}>{brl0(fiado)}</p></div>
          <div className="flex-1 pl-3" style={{ borderLeft: "1px solid var(--orbis-line)" }}><p className="orbis-mini">Custos</p><p className="orbis-num text-[15px] font-bold mt-1.5" style={{ color: custoFinal > 0 ? "var(--orbis-custo)" : "var(--orbis-fg-3)" }}>{brl0(custoFinal)}</p></div>
        </div>

        <button onClick={() => setPasso("relatorio")} className="w-full h-[46px] rounded-[14px] mt-4 text-[13.5px] font-semibold" style={{ border: "1px solid rgba(255,255,255,.12)", color: "var(--orbis-fg-2)" }}>
          Ver o relatório do dia
        </button>
      </div>

      {acabando.length > 0 && (
        <div className="rounded-[18px] border mt-3 p-4 flex items-start gap-3" style={{ borderColor: "rgba(245,184,0,.28)", background: "rgba(245,184,0,.05)" }}>
          <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.12)", color: "var(--orbis-gold)" }}><Package className="w-4 h-4" strokeWidth={2.2} /></span>
          <span className="flex-1 min-w-0">
            <b className="block text-[13.5px] font-semibold">Seu estoque está acabando</b>
            <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>{acabando.map((p) => p.nome).join(", ")} · precisa comprar mercadoria</small>
          </span>
        </div>
      )}

      <div className="rounded-[18px] border mt-3 p-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
        <p className="orbis-section">Amanhã</p>
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-[13px]" style={{ color: "var(--orbis-fg-2)" }}>Começa às</span><b className="orbis-num text-[14px]">7h00</b>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[13px]" style={{ color: "var(--orbis-fg-2)" }}>Meta</span><b className="orbis-num text-[14px]">{brl0(metaDia)}</b>
        </div>
      </div>

      <button onClick={() => setPasso("rodando")} className="w-full h-[52px] rounded-[16px] mt-5 font-extrabold text-[15px] active:scale-[.98] transition"
        style={{ background: "#E5737F", color: "#1A0A0C" }}>REABRIR E VENDER MAIS</button>

      <button onClick={zerar} className="w-full h-12 rounded-[15px] mt-3 text-[14px] font-bold inline-flex items-center justify-center gap-2"
        style={{ background: "rgba(245,184,0,.10)", border: "1px solid rgba(245,184,0,.3)", color: "var(--orbis-gold)" }}>
        <RotateCcw className="w-4 h-4" /> Rodar o teste de novo
      </button>
      <button onClick={() => navigate("/admin")} className="w-full h-10 mt-2 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ color: "var(--orbis-fg-3)" }}>
        <ArrowLeft className="w-3.5 h-3.5" /> voltar pro painel
      </button>
    </div>
  );
}
