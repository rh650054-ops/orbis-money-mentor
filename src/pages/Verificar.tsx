/* ============================================================
   VERIFICAR (/verificar) — a tela que transforma "conectar o banco" em
   "virar vendedor verificado" (Rick, 09/09/2026).
   Dois passos, nessa ordem — ele vê o que GANHA antes de qualquer conexão:
     1) benefícios: selo azul, competições valendo dinheiro, achar o calote
     2) escolher onde recebe: Mercado Pago, PagBank e a fila do "avisar"
   Já conectado, a tela vira a recompensa (selo conquistado + o que caiu).
   Todo hook acima do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, BadgeCheck, Trophy, TrendingUp, Lock, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";
import { Selo, Raios, Grao, LogoCarteira, CARTEIRAS, type Carteira } from "@/components/conectar/Selo";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const CIANO = "#7FD3FF";
const AZUL = "#3FA9FF";

interface Status { conectado: boolean; apelido: string | null; ultima_sync_em: string | null; recebido_hoje: number; pendentes_valor: number; provedores: string[]; verificado: boolean }
interface Fila { provedor: string; pessoas: number; eu: boolean }

const horaBR = (iso: string | null) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }); } catch { return ""; }
};

function Hero({ children, compacto = false }: { children: React.ReactNode; compacto?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-[26px] text-center" style={{
      padding: compacto ? "20px 18px 16px" : "26px 18px 20px",
      background: "radial-gradient(120% 80% at 50% -10%,#123f5e 0%,#0a2033 38%,#08090b 78%)",
      border: "1px solid rgba(63,169,255,.26)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.07), 0 24px 60px -30px rgba(63,169,255,.5)",
    }}>
      <Raios />
      <div className="relative">{children}</div>
    </div>
  );
}

function Cartao({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`rounded-[20px] border p-[15px] ${className}`} style={{ background: "linear-gradient(180deg,#101013,#0b0b0d)", borderColor: "#1e1d21", boxShadow: "inset 0 1px 0 rgba(255,255,255,.045)", ...style }}>{children}</div>;
}

function Beneficio({ icone, cor, titulo, texto, primeiro }: { icone: React.ReactNode; cor: string; titulo: string; texto: string; primeiro?: boolean }) {
  return (
    <div className="flex gap-3 items-start py-[13px]" style={{ borderTop: primeiro ? "none" : "1px solid #1e1d21", paddingTop: primeiro ? 2 : undefined }}>
      <span className="w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0" style={{ background: `${cor}18`, border: `1px solid ${cor}4d`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.07)" }}>{icone}</span>
      <div><p className="text-[14px] font-extrabold leading-tight tracking-tight">{titulo}</p><p className="text-[11.5px] mt-1 leading-relaxed" style={{ color: "#7b766e" }}>{texto}</p></div>
    </div>
  );
}

function BotaoOuro({ children, onClick, disabled, azul = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; azul?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="relative overflow-hidden w-full h-[54px] rounded-[16px] inline-flex items-center justify-center gap-2 text-[14.5px] font-black active:translate-y-[2px] transition-transform disabled:opacity-60"
      style={azul
        ? { background: "linear-gradient(180deg,#63BBFF,#2F9BFF 55%,#1C7FE0)", color: "#04203a", boxShadow: "0 1px 0 rgba(255,255,255,.4) inset, 0 5px 0 #14548f, 0 16px 34px rgba(47,155,255,.25)" }
        : { background: "linear-gradient(180deg,#FFD152,#F5B800 55%,#E0A500)", color: "#1a1305", boxShadow: "0 1px 0 rgba(255,255,255,.4) inset, 0 5px 0 #A87E00, 0 16px 34px rgba(245,184,0,.22)" }}>
      {children}
    </button>
  );
}

export default function Verificar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const uid = user?.id;

  const [st, setSt] = useState<Status | null>(null);
  const [fila, setFila] = useState<Fila[]>([]);
  const [passo, setPasso] = useState<1 | 2>(1);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!uid) return;
    const [s, f] = await Promise.all([(supabase as any).rpc("mp_status"), (supabase as any).rpc("mp_fila")]);
    const row = ((s.data as any[]) || [])[0];
    if (row) setSt({ ...row, recebido_hoje: Number(row.recebido_hoje) || 0, pendentes_valor: Number(row.pendentes_valor) || 0, provedores: (row.provedores as string[] | null) ?? [] });
    setFila(((f.data as any[]) || []) as Fila[]);
    setCarregando(false);
  }, [uid]);
  useEffect(() => { void carregar(); }, [carregar]);

  const conectar = async (c: Carteira) => {
    if (!c.fn) return;
    setOcupado(c.id);
    const { data, error } = await (supabase as any).functions.invoke(c.fn);
    setOcupado(null);
    if (error || !data?.url) { toast({ title: `Não deu pra abrir o ${c.nome}`, description: data?.dica || "Tenta de novo em instantes.", variant: "destructive" }); return; }
    window.location.href = data.url as string;
  };
  const querer = async (c: Carteira) => {
    setOcupado(c.id);
    await (supabase as any).rpc("mp_quero", { p_provedor: c.id });
    setOcupado(null);
    toast({ title: `Anotado: ${c.nome}`, description: "Quanto mais gente pedir, mais cedo a gente liga." });
    void carregar();
  };

  if (!uid || carregando) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#000" }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#7b766e" }} /></div>;

  const conectadas = CARTEIRAS.filter((c) => st?.provedores.includes(c.id));
  const naFila = (id: string) => fila.find((f) => f.provedor === id);
  const Topo = (
    <div className="flex items-center justify-between">
      <button type="button" onClick={() => (passo === 2 && !st?.conectado ? setPasso(1) : navigate("/finances"))} className="inline-flex items-center gap-1.5 text-[9.5px] font-black tracking-[.18em]" style={{ color: "#7b766e" }}>
        <ArrowLeft className="w-3.5 h-3.5" /> VOLTAR
      </button>
      {!st?.conectado && (
        <span className="flex gap-1.5">
          {[1, 2].map((n) => <i key={n} className="w-[5px] h-[5px] rounded-full" style={n === passo ? { background: CIANO, boxShadow: `0 0 8px ${CIANO}` } : { background: "#26262b" }} />)}
        </span>
      )}
      <span className="w-12" />
    </div>
  );

  // ===== JÁ CONECTADO: a recompensa =====
  if (st?.conectado) {
    return (
      <div className="min-h-screen relative px-4 pt-4 pb-28 max-w-lg mx-auto flex flex-col gap-3" style={{ background: "#000" }}>
        <Grao />
        <div className="relative flex flex-col gap-3">
          {Topo}
          <Hero>
            <div className="flex justify-center"><Selo size={96} /></div>
            <p className="text-[10px] font-black tracking-[.2em] mt-3.5" style={{ color: CIANO }}>CONTA COMPROVADA</p>
            <p className="text-[25px] font-black tracking-[-.035em] leading-[1.08] mt-1.5">Você é um vendedor<br /><span style={{ color: CIANO }}>VERIFICADO</span></p>
            <div className="flex justify-center gap-1.5 mt-3">
              <span className="rounded-full px-2.5 py-1 text-[9.5px] font-extrabold border" style={{ background: "rgba(63,169,255,.1)", borderColor: "rgba(63,169,255,.4)", color: CIANO }}>selo no ranking</span>
              <span className="rounded-full px-2.5 py-1 text-[9.5px] font-extrabold border" style={{ background: "rgba(245,184,0,.08)", borderColor: "rgba(245,184,0,.32)", color: GOLD }}>X1 valendo liberado</span>
            </div>
          </Hero>

          <Cartao>
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] font-black tracking-[.18em]" style={{ color: OK }}>COMPROVADO HOJE</p>
              <span className="rounded-full px-2.5 py-1 text-[9.5px] font-extrabold border" style={{ background: "#131316", borderColor: "#232327", color: "#ddd8d0" }}>confere sozinho{st.ultima_sync_em ? ` · ${horaBR(st.ultima_sync_em)}` : ""}</span>
            </div>
            <p className="text-[32px] font-black tabular-nums tracking-[-.035em] leading-none mt-2.5" style={{ color: OK }}>{formatCurrency(st.recebido_hoje)}</p>
            <p className="text-[11.5px] mt-1" style={{ color: "#7b766e" }}>caiu na sua conta hoje{st.pendentes_valor > 0 ? ` · ${formatCurrency(st.pendentes_valor)} ainda não lançados` : ""}</p>
          </Cartao>

          <Cartao className="!py-[5px] !px-[15px]">
            {CARTEIRAS.filter((c) => c.fn).map((c, i) => {
              const ligada = st.provedores.includes(c.id);
              return (
                <div key={c.id} className="flex gap-3 items-center py-[13px]" style={{ borderTop: i === 0 ? "none" : "1px solid #1e1d21" }}>
                  <LogoCarteira sigla={c.sigla} fundo={c.fundo} cor={c.cor} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-extrabold leading-tight">{c.nome}</p>
                    <p className="text-[11.5px] mt-0.5 truncate" style={{ color: "#7b766e" }}>{ligada ? `${st.apelido ?? "conectado"} · ativo` : "recebe aqui também? liga em 30s"}</p>
                  </div>
                  {ligada ? (
                    <span className="rounded-full px-2.5 py-1 text-[9.5px] font-extrabold border shrink-0" style={{ background: "rgba(61,214,140,.08)", borderColor: "rgba(61,214,140,.35)", color: OK }}>● ATIVO</span>
                  ) : (
                    <button type="button" onClick={() => conectar(c)} disabled={!!ocupado} className="h-9 px-4 rounded-[12px] text-[11.5px] font-black shrink-0" style={{ background: "linear-gradient(180deg,#63BBFF,#2F9BFF)", color: "#04203a", boxShadow: "0 3px 0 #14548f" }}>
                      {ocupado === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "LIGAR"}
                    </button>
                  )}
                </div>
              );
            })}
          </Cartao>

          {conectadas.length < 2 && (
            <Cartao style={{ borderColor: "rgba(245,184,0,.22)", background: "linear-gradient(160deg,#17120a,#0b0b0d)" }}>
              <p className="text-[14px] font-extrabold" style={{ color: GOLD }}>Falta 1 conta pra virar OURO</p>
              <p className="text-[11.5px] mt-1" style={{ color: "#7b766e" }}>Quem liga duas comprova quase tudo que vende — e o "não caiu" para de mentir.</p>
            </Cartao>
          )}

          <button type="button" onClick={() => navigate("/finances")} className="w-full h-[46px] rounded-[16px] text-[12.5px] font-extrabold mt-auto" style={{ background: "#131316", color: "#d9d4cc", border: "1px solid #232327" }}>Voltar pra Finanças</button>
        </div>
      </div>
    );
  }

  // ===== PASSO 1: os benefícios =====
  if (passo === 1) {
    return (
      <div className="min-h-screen relative px-4 pt-4 pb-8 max-w-lg mx-auto flex flex-col gap-3" style={{ background: "#000" }}>
        <Grao />
        <div className="relative flex flex-col gap-3 flex-1">
          {Topo}
          <Hero>
            <div className="flex justify-center"><Selo size={104} /></div>
            <p className="text-[27px] font-black tracking-[-.035em] leading-[1.08] mt-4">Vendedor<br />verificado</p>
            <p className="text-[13px] mt-2.5 leading-relaxed" style={{ color: "#a9a49c" }}>Três coisas mudam no seu Orbis quando os seus números deixam de ser palavra e viram prova.</p>
          </Hero>

          <Cartao>
            <Beneficio primeiro cor={AZUL} icone={<BadgeCheck className="w-[19px] h-[19px]" style={{ color: CIANO }} strokeWidth={2.4} />}
              titulo="O selo azul no seu nome" texto="No ranking, no X1, no seu perfil. É o sinal de que o que você fatura é conferido — e não digitado." />
            <Beneficio cor={GOLD} icone={<Trophy className="w-[19px] h-[19px]" style={{ color: GOLD }} strokeWidth={2.4} />}
              titulo="Competições valendo dinheiro" texto="X1 com aposta e campeonatos com prêmio só abrem pra conta verificada. É o que garante que ninguém ganha inventando venda." />
            <Beneficio cor={OK} icone={<TrendingUp className="w-[19px] h-[19px]" style={{ color: OK }} strokeWidth={2.4} />}
              titulo="Descobre quem não te pagou" texto="Todo fim de dia o Orbis compara o que você lançou com o que caiu. A diferença é calote — e some do seu lucro de mentira." />
          </Cartao>

          <div className="flex gap-2.5 items-start rounded-[16px] px-3.5 py-3" style={{ background: "rgba(61,214,140,.045)", border: "1px solid rgba(61,214,140,.2)" }}>
            <Lock className="w-4 h-4 shrink-0 mt-0.5" style={{ color: OK }} strokeWidth={2.3} />
            <p className="text-[11.5px] leading-relaxed" style={{ color: "#7b766e" }}>O Orbis <b className="text-white font-extrabold">só lê</b> o que entrou. Não move dinheiro, não pede senha — você autoriza dentro do app do seu banco e desliga quando quiser.</p>
          </div>

          <div className="mt-auto pt-2">
            <BotaoOuro azul onClick={() => setPasso(2)}><Selo size={22} /> QUERO SER VERIFICADO</BotaoOuro>
            <p className="text-[11.5px] text-center mt-2.5" style={{ color: "#7b766e" }}>Leva 30 segundos · não custa nada</p>
          </div>
        </div>
      </div>
    );
  }

  // ===== PASSO 2: escolher onde recebe =====
  return (
    <div className="min-h-screen relative px-4 pt-4 pb-8 max-w-lg mx-auto flex flex-col gap-3" style={{ background: "#000" }}>
      <Grao />
      <div className="relative flex flex-col gap-3 flex-1">
        {Topo}
        <div className="px-0.5 pt-1">
          <p className="text-[23px] font-black tracking-[-.035em] leading-[1.1]">Onde você<br />recebe?</p>
          <p className="text-[13px] mt-2 leading-relaxed" style={{ color: "#a9a49c" }}>Escolha uma. Dá pra ligar mais depois — quanto mais contas, mais do seu faturamento fica comprovado.</p>
        </div>

        <Cartao className="!py-[5px] !px-[15px]">
          {CARTEIRAS.map((c, i) => {
            const pedido = naFila(c.id);
            return (
              <div key={c.id} className="flex gap-3 items-center py-[13px]" style={{ borderTop: i === 0 ? "none" : "1px solid #1e1d21" }}>
                <LogoCarteira sigla={c.sigla} fundo={c.fundo} cor={c.cor} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-extrabold leading-tight" style={c.fn ? undefined : { color: "#a9a49c" }}>{c.nome}</p>
                  <p className="text-[11.5px] mt-0.5" style={{ color: "#7b766e" }}>{c.linha}{!c.fn && pedido?.pessoas ? ` · ${pedido.pessoas} esperando` : ""}</p>
                </div>
                {c.fn ? (
                  <button type="button" onClick={() => conectar(c)} disabled={!!ocupado} className="h-9 px-4 rounded-[12px] text-[11.5px] font-black shrink-0" style={{ background: "linear-gradient(180deg,#63BBFF,#2F9BFF)", color: "#04203a", boxShadow: "0 3px 0 #14548f" }}>
                    {ocupado === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "LIGAR"}
                  </button>
                ) : pedido?.eu ? (
                  <span className="h-9 px-3 rounded-[12px] inline-flex items-center gap-1 text-[11px] font-black shrink-0" style={{ background: "rgba(61,214,140,.08)", border: "1px solid rgba(61,214,140,.35)", color: OK }}><Check className="w-3.5 h-3.5" strokeWidth={3} /> na fila</span>
                ) : (
                  <button type="button" onClick={() => querer(c)} disabled={!!ocupado} className="h-9 px-4 rounded-[12px] text-[11.5px] font-black shrink-0" style={{ background: "#131316", border: "1px solid #232327", color: "#7b766e" }}>
                    {ocupado === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "avisar"}
                  </button>
                )}
              </div>
            );
          })}
        </Cartao>

        <Cartao style={{ borderColor: "rgba(245,184,0,.22)", background: "linear-gradient(160deg,#17120a,#0b0b0d)" }}>
          <p className="text-[14px] font-extrabold" style={{ color: GOLD }}>Recebe em outro lugar?</p>
          <p className="text-[11.5px] mt-1" style={{ color: "#7b766e" }}>Toca em "avisar" e a gente liga o seu primeiro. A fila manda na ordem.</p>
        </Cartao>

        <div className="flex gap-2.5 items-start rounded-[16px] px-3.5 py-3 mt-auto" style={{ background: "rgba(61,214,140,.045)", border: "1px solid rgba(61,214,140,.2)" }}>
          <Lock className="w-4 h-4 shrink-0 mt-0.5" style={{ color: OK }} strokeWidth={2.3} />
          <p className="text-[11.5px] leading-relaxed" style={{ color: "#7b766e" }}>Você vai ver a tela do seu banco, não a do Orbis. A senha é digitada lá, e nós nunca vemos.</p>
        </div>
      </div>
    </div>
  );
}
