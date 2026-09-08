/* ============================================================
   ARENA X1 (Rick, 08/09/2026) — "chame qualquer vendedor, quem vende mais
   no dia leva". Foco em DUELO AMISTOSO (honra) pra todo mundo se desafiar;
   dinheiro só destrava por patente. Tudo com a FOTO REAL do vendedor.

   Blocos (de cima pra baixo, no máximo 1 coisa pedindo ação por vez):
     1. Hero: foto, patente, recorde/sequência/posição, próxima patente
     2. Duelo de hoje AO VIVO (placar via x1_placar a cada 20s)
     3. Convites esperando VOCÊ (TOPO · honra só · ✕) e os que você mandou
     4. Chamada geral (x1_chamadas_abertas) — TOPO
     5. Rivais na sua altura (x1_rivais) — CHAMAR / REVANCHE
     6. Patentes · histórico
     7. CTA fixo: ABRIR CHAMADA GERAL
   Carteira (depósito/saque) mora em /x1/carteira (X1Carteira.tsx).
   Todo hook acima do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Swords, Wallet, Check, X, ChevronRight, Loader2, Trophy, Flame, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { X1Avatar } from "@/components/x1/X1Avatar";
import { ChamarSheet, type ChamarAlvo } from "@/components/x1/ChamarSheet";
import { X1ResultadoCard, type Resultado } from "@/components/x1/X1ResultadoCard";
import {
  fmt, primeiroNome, quandoTexto, expiraEm, horasAteMeiaNoite, erroBonito, patenteCor, PATENTES,
  carregarRecorde, carregarPessoas, resultadoDe, chaveVisto,
  type Duelo, type Pessoa, type Recorde, RECORDE_VAZIO,
} from "@/components/x1/x1-lib";

const GOLD = "#F5B800";
const RED = "#F2465A";
const OK = "#3DD68C";
const HOT = "#ff7a1a";

interface Aberta { id: string; challenger_id: string; nome: string; avatar_url: string | null; patente: string; vitorias: number; scheduled_date: string; stakes_amount: number; liga_min_rank: number | null; expires_at: string; cidade: string | null }
interface Rival { user_id: string; nome: string; avatar_url: string | null; posicao: number; diferenca: number; vitorias_contra: number; derrotas_contra: number; patente: string }

/* ---------- peças visuais (fora do componente pai) ---------- */
function Mini({ children, cor = "#8a8378", className = "" }: { children: React.ReactNode; cor?: string; className?: string }) {
  return <p className={`text-[10px] font-black tracking-[.16em] ${className}`} style={{ color: cor }}>{children}</p>;
}
function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`rounded-[20px] border p-3.5 ${className}`} style={{ background: "#0e0e10", borderColor: "#22201a", ...style }}>{children}</div>;
}
function Botao({ children, onClick, tom = "neutro", disabled, className = "" }: { children: React.ReactNode; onClick: () => void; tom?: "neutro" | "ouro" | "verde" | "vermelho"; disabled?: boolean; className?: string }) {
  const st = tom === "ouro" ? { background: GOLD, borderColor: GOLD, color: "#1a1305" }
    : tom === "verde" ? { background: "#0d1f16", borderColor: `${OK}66`, color: OK }
    : tom === "vermelho" ? { background: "#2a0c11", borderColor: `${RED}66`, color: "#ff7d8c" }
    : { background: "#16151a", borderColor: "#2a2823", color: "#e9e4d8" };
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`h-[34px] px-3 rounded-[11px] border inline-flex items-center justify-center gap-1.5 text-[12px] font-black active:scale-[0.96] transition-transform disabled:opacity-50 shrink-0 ${className}`} style={st}>
      {children}
    </button>
  );
}
function Chip({ children, tom = "neutro" }: { children: React.ReactNode; tom?: "neutro" | "ouro" | "verde" | "vermelho" }) {
  const st = tom === "ouro" ? { background: "#1a1305", borderColor: "#3a2f0c", color: GOLD }
    : tom === "verde" ? { background: "#0d1f16", borderColor: `${OK}55`, color: OK }
    : tom === "vermelho" ? { background: "#2a0c11", borderColor: `${RED}66`, color: "#ff7d8c" }
    : { background: "#16151a", borderColor: "#2a2823", color: "#e9e4d8" };
  return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold border whitespace-nowrap" style={st}>{children}</span>;
}

/* ---------- página ---------- */
export default function X1() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const uid = user?.id;
  const hoje = getBrazilDate();

  const [eu, setEu] = useState<Pessoa | null>(null);
  const [recorde, setRecorde] = useState<Recorde>(RECORDE_VAZIO);
  const [arenaPos, setArenaPos] = useState<number | null>(null);
  const [saldo, setSaldo] = useState(0);
  const [duelos, setDuelos] = useState<Duelo[]>([]);
  const [pessoas, setPessoas] = useState<Record<string, Pessoa>>({});
  const [abertas, setAbertas] = useState<Aberta[]>([]);
  const [rivais, setRivais] = useState<Rival[]>([]);
  const [placar, setPlacar] = useState<{ ch: number; op: number } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [agindo, setAgindo] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ alvo: ChamarAlvo | null; quando: "hoje" | "amanha" } | null>(null);
  const [resultado, setResultado] = useState<{ r: Resultado; ele: Pessoa } | null>(null);

  const carregar = useCallback(async () => {
    if (!uid) return;
    const [rec, pos, w, d, ab, rv, pp] = await Promise.all([
      carregarRecorde(uid),
      (supabase as any).rpc("x1_arena_rank", { p_user: uid }),
      supabase.from("x1_wallets" as any).select("balance").eq("user_id", uid).maybeSingle(),
      supabase.from("x1_challenges" as any)
        .select("id, challenger_id, opponent_id, status, scheduled_date, stakes_amount, prize_amount, winner_user_id, last_proposed_by, tipo, expires_at, created_at, money_status")
        .or(`challenger_id.eq.${uid},opponent_id.eq.${uid}`)
        .order("created_at", { ascending: false }).limit(40),
      (supabase as any).rpc("x1_chamadas_abertas"),
      (supabase as any).rpc("x1_rivais"),
      supabase.from("public_profiles").select("user_id, nickname, avatar_url").eq("user_id", uid).maybeSingle(),
    ]);
    setRecorde(rec);
    setArenaPos(typeof pos.data === "number" ? pos.data : null);
    setSaldo(Number((w.data as any)?.balance) || 0);
    const lista = ((d.data as any[]) || []).map((c) => ({ ...c, stakes_amount: Number(c.stakes_amount) || 0, prize_amount: Number(c.prize_amount) || 0 })) as Duelo[];
    setDuelos(lista);
    setAbertas(((ab.data as any[]) || []).map((a) => ({ ...a, stakes_amount: Number(a.stakes_amount) || 0, vitorias: Number(a.vitorias) || 0 })) as Aberta[]);
    setRivais(((rv.data as any[]) || []).map((r) => ({ ...r, diferenca: Number(r.diferenca) || 0 })) as Rival[]);
    const p = pp.data as any;
    setEu({ user_id: uid, nome: p?.nickname || "Você", avatar_url: p?.avatar_url || null });
    const ids = lista.flatMap((c) => [c.challenger_id, c.opponent_id || ""]);
    setPessoas(await carregarPessoas(ids));
    setCarregando(false);
  }, [uid]);

  useEffect(() => { void carregar(); }, [carregar]);

  const duelosHoje = useMemo(() => duelos.filter((c) => c.status === "active" && c.scheduled_date === hoje), [duelos, hoje]);
  const dueloHoje = duelosHoje[0] || null;
  const proximos = useMemo(() => duelos.filter((c) => c.status === "active" && (c.scheduled_date || "") > hoje), [duelos, hoje]);
  const recebidos = useMemo(() => duelos.filter((c) => c.status === "pending" && c.last_proposed_by !== uid), [duelos, uid]);
  const enviados = useMemo(() => duelos.filter((c) => c.status === "pending" && c.last_proposed_by === uid), [duelos, uid]);
  const minhaAberta = useMemo(() => duelos.find((c) => c.status === "open" && c.challenger_id === uid) || null, [duelos, uid]);
  const historico = useMemo(() => duelos.filter((c) => c.status === "finished").slice(0, 8), [duelos]);
  const outro = useCallback((c: Duelo) => (c.challenger_id === uid ? c.opponent_id || "" : c.challenger_id), [uid]);
  const pessoa = useCallback((id: string): Pessoa => pessoas[id] || { user_id: id, nome: "Vendedor", avatar_url: null }, [pessoas]);

  // Placar ao vivo do duelo de hoje — a cada 20s.
  useEffect(() => {
    if (!dueloHoje) { setPlacar(null); return; }
    let vivo = true;
    const puxar = async () => {
      const { data } = await (supabase as any).rpc("x1_placar", { p_id: dueloHoje.id });
      const row = ((data as any[]) || [])[0];
      if (vivo && row) setPlacar({ ch: Number(row.challenger_total) || 0, op: Number(row.opponent_total) || 0 });
    };
    void puxar();
    const t = setInterval(puxar, 20000);
    return () => { vivo = false; clearInterval(t); };
  }, [dueloHoje]);

  // Resultado novo (fechado nas últimas 48h e ainda não visto) → card.
  useEffect(() => {
    if (!uid || duelos.length === 0) return;
    const limite = new Date(Date.now() - 48 * 3600 * 1000).toISOString().slice(0, 10);
    const novo = duelos.find((c) => c.status === "finished" && (c.scheduled_date || "") >= limite && !localStorage.getItem(chaveVisto(c.id)));
    if (!novo) return;
    let vivo = true;
    (async () => {
      const { data } = await (supabase as any).rpc("x1_placar", { p_id: novo.id });
      const row = ((data as any[]) || [])[0];
      const iAmCh = novo.challenger_id === uid;
      const meu = row ? Number(iAmCh ? row.challenger_total : row.opponent_total) || 0 : 0;
      const dele = row ? Number(iAmCh ? row.opponent_total : row.challenger_total) || 0 : 0;
      const tipo = resultadoDe(novo, uid);
      if (!vivo) return;
      setResultado({ r: { id: novo.id, tipo, meu, dele, premio: tipo === "vitoria" ? novo.prize_amount : 0, aposta: novo.stakes_amount }, ele: pessoa(outro(novo)) });
    })();
    return () => { vivo = false; };
  }, [uid, duelos, pessoa, outro]);

  // ?desafiar=uid (vem do ranking / relatório) → abre a folha já com o alvo.
  useEffect(() => {
    const alvo = params.get("desafiar");
    if (!alvo || !uid || alvo === uid) return;
    const quando = params.get("quando") === "amanha" ? "amanha" : "hoje";
    carregarPessoas([alvo]).then((m) => {
      setSheet({ alvo: m[alvo] || { user_id: alvo, nome: "Vendedor", avatar_url: null }, quando });
      setParams({}, { replace: true });
    });
  }, [params, uid, setParams]);

  const rpc = async (chave: string, fn: string, args: Record<string, unknown>, ok: string) => {
    setAgindo(chave);
    const { error } = await (supabase as any).rpc(fn, args);
    setAgindo(null);
    if (error) { toast({ title: "Não rolou", description: erroBonito(error.message), variant: "destructive" }); return false; }
    toast({ title: ok });
    await carregar();
    return true;
  };
  const aceitar = (c: Duelo) => rpc(c.id, "x1_negotiate", { p_id: c.id, p_action: "accept" }, c.scheduled_date === hoje ? "Duelo iniciado! Vai vender." : "Fechado! Duelo marcado.");
  const recusar = (c: Duelo) => rpc(c.id, "x1_negotiate", { p_id: c.id, p_action: "decline" }, "Desafio recusado");
  const honraSo = (c: Duelo) => rpc(c.id, "x1_negotiate", { p_id: c.id, p_action: "counter", p_stakes: 0 }, "Proposta de amistoso enviada");
  const topar = (a: Aberta) => rpc(a.id, "x1_aceitar_aberto", { p_id: a.id }, `Duelo com ${primeiroNome(a.nome)} marcado!`);
  const cancelarAberta = (id: string) => rpc(id, "x1_cancelar_aberto", { p_id: id }, "Chamada cancelada");

  const fecharResultado = () => { if (resultado) localStorage.setItem(chaveVisto(resultado.r.id), "1"); setResultado(null); };
  const revanche = () => {
    if (!resultado) return;
    const ele = resultado.ele;
    fecharResultado();
    setSheet({ alvo: { user_id: ele.user_id, nome: ele.nome, avatar_url: ele.avatar_url }, quando: "amanha" });
  };

  if (!uid) return null;

  const eu_ = eu || { user_id: uid, nome: "Você", avatar_url: null };
  const corPat = patenteCor(recorde.patente);
  const faltam = recorde.proxima != null ? Math.max(0, recorde.proxima - recorde.vitorias) : null;
  const proximaPat = PATENTES[Math.min(PATENTES.length - 1, PATENTES.findIndex((p) => p.nome === recorde.patente) + 1)];
  const iAmCh = dueloHoje ? dueloHoje.challenger_id === uid : true;
  const meuHoje = placar ? (iAmCh ? placar.ch : placar.op) : 0;
  const deleHoje = placar ? (iAmCh ? placar.op : placar.ch) : 0;
  const pctHoje = meuHoje + deleHoje > 0 ? Math.round((meuHoje / (meuHoje + deleHoje)) * 100) : 50;
  const abertasDosOutros = abertas.filter((a) => a.challenger_id !== uid);

  return (
    <div className="min-h-screen pb-32 px-4 pt-3 max-w-2xl mx-auto space-y-3" style={{ background: "#000" }}>
      {/* topo */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#b3ab9c" }}><ArrowLeft className="w-5 h-5" /></button>
        <p className="flex-1 text-[15px] font-black tracking-tight">Arena X1</p>
        <button type="button" onClick={() => navigate("/x1/carteira")} className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[11.5px] font-black active:scale-95 transition-transform" style={{ background: "#1a1305", border: "1px solid #3a2f0c", color: GOLD }}>
          <Wallet className="w-3.5 h-3.5" strokeWidth={2.6} /> {fmt(saldo)}
        </button>
      </div>

      {/* 1. HERO */}
      <div className="rounded-[22px] p-4 relative overflow-hidden orbis-card-in" style={{ background: "radial-gradient(120% 90% at 15% 0%,#2a0c11 0%,#140508 45%,#0b0b0d 100%)", border: `1px solid ${RED}55` }}>
        <div className="flex items-start gap-3">
          <X1Avatar url={eu_.avatar_url} nome={eu_.nome} size={56} cor={GOLD} />
          <div className="flex-1 min-w-0">
            <p className="text-[24px] font-black tracking-[-.03em] leading-none">{primeiroNome(eu_.nome)}</p>
            <p className="text-[12px] mt-1" style={{ color: "#b3ab9c" }}>Chame qualquer vendedor. Quem vende mais no dia leva.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-black shrink-0" style={{ background: `${corPat}1a`, border: `1px solid ${corPat}`, color: corPat }}>{recorde.patente}</span>
        </div>
        <div className="flex gap-2 mt-3">
          {[
            { k: "RECORDE", v: `${recorde.vitorias}V · ${recorde.derrotas}D`, c: OK },
            { k: "SEQUÊNCIA", v: recorde.sequencia > 0 ? `${recorde.sequencia} ${recorde.sequencia === 1 ? "vitória" : "vitórias"}` : "—", c: recorde.sequencia >= 2 ? HOT : "#fff" },
            { k: "ARENA", v: arenaPos ? `#${arenaPos}` : "—", c: "#fff" },
          ].map((t) => (
            <div key={t.k} className="flex-1 rounded-[14px] px-2 py-2.5 text-center" style={{ background: "#0a0a0d", border: "1px solid #22201a" }}>
              <p className="text-[9px] font-black tracking-[.1em]" style={{ color: "#8a8378" }}>{t.k}</p>
              <p className="text-[16px] font-black tabular-nums mt-0.5 leading-tight" style={{ color: t.c }}>{t.v}</p>
            </div>
          ))}
        </div>
        <p className="text-[11.5px] mt-2.5" style={{ color: "#8a8378" }}>
          {recorde.duelos === 0
            ? <>Seu primeiro duelo conta pra patente. Comece por um <b className="text-white">amistoso</b> — sem dinheiro, só honra.</>
            : faltam != null
              ? <>Faltam <b className="text-white">{faltam} {faltam === 1 ? "vitória" : "vitórias"}</b> pra virar <b style={{ color: patenteCor(proximaPat.nome) }}>{proximaPat.nome}</b> e liberar aposta {proximaPat.aposta}.</>
              : <>Você é <b style={{ color: corPat }}>LENDA</b> da arena. Aposta livre.</>}
        </p>
      </div>

      {carregando && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8a8378" }} /></div>}

      {/* 2. DUELO DE HOJE */}
      {dueloHoje && (() => {
        const ele = pessoa(outro(dueloHoje));
        const lidero = meuHoje > deleHoje; const atras = deleHoje > meuHoje;
        return (
          <Card className="orbis-card-in" style={{ background: "linear-gradient(160deg,#1a1305,#0e0e10)", borderColor: `${GOLD}55` }}>
            <div className="flex items-center justify-between">
              <Mini cor={GOLD}>DUELO DE HOJE · AO VIVO</Mini>
              {dueloHoje.stakes_amount > 0 ? <Chip tom="vermelho">POTE {fmt(dueloHoje.stakes_amount * 2)}</Chip> : <Chip tom="ouro">AMISTOSO</Chip>}
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <div className="flex-1 flex items-center gap-2">
                <X1Avatar url={eu_.avatar_url} nome={eu_.nome} size={44} cor={GOLD} />
                <div><p className="text-[16px] font-black tabular-nums leading-none" style={{ color: lidero ? OK : "#fff" }}>{fmt(meuHoje)}</p><p className="text-[11px] mt-0.5" style={{ color: "#8a8378" }}>você</p></div>
              </div>
              <span className="text-[18px] font-black italic" style={{ color: GOLD, textShadow: `0 0 14px ${GOLD}88` }}>VS</span>
              <div className="flex-1 flex items-center gap-2 justify-end text-right">
                <div><p className="text-[16px] font-black tabular-nums leading-none" style={{ color: atras ? "#ff7d8c" : "#fff" }}>{fmt(deleHoje)}</p><p className="text-[11px] mt-0.5" style={{ color: "#8a8378" }}>{primeiroNome(ele.nome)}</p></div>
                <X1Avatar url={ele.avatar_url} nome={ele.nome} size={44} cor={RED} />
              </div>
            </div>
            <div className="h-2 rounded-full mt-2.5 overflow-hidden" style={{ background: "#2a1418" }}><i className="block h-full rounded-full" style={{ width: `${pctHoje}%`, background: "linear-gradient(90deg,#1f8f5c,#3DD68C)" }} /></div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] font-extrabold" style={{ color: lidero ? OK : atras ? "#ff7d8c" : "#b3ab9c" }}>
                {lidero ? `Você lidera por ${fmt(meuHoje - deleHoje)}` : atras ? `${primeiroNome(ele.nome)} lidera por ${fmt(deleHoje - meuHoje)}` : "Empatados — a próxima venda decide"}
              </span>
              <span className="text-[11px]" style={{ color: "#8a8378" }}>fecha 23:59 · {horasAteMeiaNoite()}h</span>
            </div>
            <button type="button" onClick={() => navigate("/defcon")} className="orbis-cta w-full mt-3" style={{ background: "linear-gradient(160deg,#7f1d1d,#450a0a)", color: "#fecaca", border: "1px solid #ef444499" }}>
              <Flame className="w-4 h-4" strokeWidth={2.6} /> VENDER AGORA · DEFCON
            </button>
          </Card>
        );
      })()}

      {/* próximos marcados */}
      {proximos.map((c) => { const ele = pessoa(outro(c)); return (
        <Card key={c.id} className="flex items-center gap-3">
          <X1Avatar url={ele.avatar_url} nome={ele.nome} size={36} cor={RED} />
          <div className="flex-1 min-w-0"><p className="text-[13.5px] font-black truncate">Duelo marcado com {primeiroNome(ele.nome)}</p><p className="text-[11px]" style={{ color: "#8a8378" }}>{quandoTexto(c.scheduled_date)} · {c.stakes_amount > 0 ? `valendo ${fmt(c.stakes_amount)} cada` : "amistoso"} · conta pelo DEFCON</p></div>
          <Chip tom="ouro">MARCADO</Chip>
        </Card>
      ); })}

      {/* 3. CONVITES */}
      {recebidos.map((c) => { const ele = pessoa(outro(c)); const ocupado = agindo === c.id; return (
        <Card key={c.id} className="orbis-card-in" style={{ borderColor: `${RED}66` }}>
          <div className="flex items-center gap-2.5">
            <X1Avatar url={ele.avatar_url} nome={ele.nome} size={40} cor={RED} />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-black truncate">{primeiroNome(ele.nome)} te chamou</p>
              <p className="text-[11px]" style={{ color: "#8a8378" }}>{quandoTexto(c.scheduled_date)} · {c.stakes_amount > 0 ? `valendo ${fmt(c.stakes_amount)} cada` : "amistoso"} · {expiraEm(c.expires_at)}</p>
            </div>
            <Botao tom="verde" onClick={() => aceitar(c)} disabled={ocupado}>{ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" strokeWidth={3} /> TOPO</>}</Botao>
            <Botao tom="vermelho" onClick={() => recusar(c)} disabled={ocupado} className="px-2.5"><X className="w-4 h-4" strokeWidth={3} /></Botao>
          </div>
          {c.stakes_amount > 0 && (
            <button type="button" onClick={() => honraSo(c)} disabled={ocupado} className="mt-2.5 w-full h-9 rounded-[11px] text-[11.5px] font-black inline-flex items-center justify-center gap-1.5" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
              <Handshake className="w-3.5 h-3.5" strokeWidth={2.6} /> Topo só na honra (sem dinheiro)
            </button>
          )}
        </Card>
      ); })}
      {enviados.map((c) => { const ele = pessoa(outro(c)); return (
        <Card key={c.id} className="flex items-center gap-3">
          <X1Avatar url={ele.avatar_url} nome={ele.nome} size={36} cor="#8a8378" />
          <div className="flex-1 min-w-0"><p className="text-[13px] font-black truncate">Esperando {primeiroNome(ele.nome)} responder</p><p className="text-[11px]" style={{ color: "#8a8378" }}>{quandoTexto(c.scheduled_date)} · {c.stakes_amount > 0 ? `${fmt(c.stakes_amount)} cada` : "amistoso"} · {expiraEm(c.expires_at)}</p></div>
          <Chip>ENVIADO</Chip>
        </Card>
      ); })}

      {/* 4. CHAMADA GERAL */}
      <div className="flex items-center justify-between pt-1 px-0.5">
        <p className="text-[14px] font-black">Chamada geral</p>
        <Chip tom={abertasDosOutros.length > 0 ? "ouro" : "neutro"}>{abertasDosOutros.length > 0 ? `${abertasDosOutros.length} ${abertasDosOutros.length === 1 ? "aberta" : "abertas"} agora` : "nenhuma agora"}</Chip>
      </div>
      {minhaAberta && (
        <Card className="flex items-center gap-3" style={{ borderColor: `${GOLD}55` }}>
          <X1Avatar url={eu_.avatar_url} nome={eu_.nome} size={36} cor={GOLD} />
          <div className="flex-1 min-w-0"><p className="text-[13px] font-black">Sua chamada está aberta</p><p className="text-[11px]" style={{ color: "#8a8378" }}>{quandoTexto(minhaAberta.scheduled_date)} · {minhaAberta.stakes_amount > 0 ? `${fmt(minhaAberta.stakes_amount)} cada` : "amistoso"} · {expiraEm(minhaAberta.expires_at)}</p></div>
          <Botao onClick={() => cancelarAberta(minhaAberta.id)} disabled={agindo === minhaAberta.id}>cancelar</Botao>
        </Card>
      )}
      {abertasDosOutros.length > 0 ? (
        <Card className="px-3.5 py-1">
          {abertasDosOutros.map((a) => {
            return (
              <div key={a.id} className="flex items-center gap-2.5 py-2.5" style={{ borderTop: "1px solid #22201a" }}>
                <X1Avatar url={a.avatar_url} nome={a.nome} size={36} cor={patenteCor(a.patente)} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black truncate">{primeiroNome(a.nome)} · <span style={{ color: patenteCor(a.patente) }}>{a.patente}</span></p>
                  <p className="text-[11px] truncate" style={{ color: "#8a8378" }}>{quandoTexto(a.scheduled_date)} · {a.stakes_amount > 0 ? `${fmt(a.stakes_amount)} cada` : "amistoso"}{a.cidade ? ` · ${a.cidade}` : ""} · {expiraEm(a.expires_at)}</p>
                </div>
                <Botao tom="ouro" onClick={() => topar(a)} disabled={agindo === a.id}>{agindo === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "TOPO"}</Botao>
              </div>
            );
          })}
        </Card>
      ) : !minhaAberta ? (
        <Card className="text-center py-5">
          <p className="text-[13px] font-black">Ninguém abriu chamada ainda hoje</p>
          <p className="text-[11.5px] mt-1" style={{ color: "#8a8378" }}>Abra a sua — quem topar primeiro entra. Amistoso vale patente igual.</p>
        </Card>
      ) : null}

      {/* 5. RIVAIS */}
      <div className="flex items-center justify-between pt-1 px-0.5">
        <p className="text-[14px] font-black">Rivais na sua altura</p>
        <button type="button" onClick={() => navigate("/ranking")} className="text-[11px] inline-flex items-center gap-0.5" style={{ color: "#8a8378" }}>ranking <ChevronRight className="w-3 h-3" /></button>
      </div>
      {rivais.length > 0 ? (
        <Card className="px-3.5 py-1">
          {rivais.map((r) => {
            const jaDuelaram = r.vitorias_contra + r.derrotas_contra > 0;
            const frente = r.diferenca > 0;
            return (
              <div key={r.user_id} className="flex items-center gap-2.5 py-2.5" style={{ borderTop: "1px solid #22201a" }}>
                <X1Avatar url={r.avatar_url} nome={r.nome} size={36} cor={frente ? RED : "#b3ab9c"} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black truncate">{primeiroNome(r.nome)} · #{r.posicao}</p>
                  <p className="text-[11px] truncate" style={{ color: "#8a8378" }}>
                    {frente ? `${fmt(r.diferenca)} na sua frente` : `${fmt(Math.abs(r.diferenca))} atrás de você`} · {jaDuelaram ? `${r.vitorias_contra}V ${r.derrotas_contra}D contra` : "nunca duelaram"}
                  </p>
                </div>
                <Botao onClick={() => setSheet({ alvo: { user_id: r.user_id, nome: r.nome, avatar_url: r.avatar_url }, quando: "hoje" })}>{jaDuelaram ? "REVANCHE" : "CHAMAR"}</Botao>
              </div>
            );
          })}
        </Card>
      ) : !carregando ? (
        <Card className="text-center py-5">
          <p className="text-[13px] font-black">Entre no ranking pra ver seus rivais</p>
          <p className="text-[11.5px] mt-1" style={{ color: "#8a8378" }}>Um DEFCON hoje te coloca no ranking do mês — e mostra quem tá na sua altura.</p>
          <button type="button" onClick={() => navigate("/defcon")} className="orbis-cta w-full mt-3"><Flame className="w-4 h-4" strokeWidth={2.6} /> FAZER UM DEFCON</button>
        </Card>
      ) : null}

      {/* 6. PATENTES */}
      <Card>
        <Mini>PATENTES DA ARENA</Mini>
        <div className="flex gap-1.5 mt-2">
          {PATENTES.map((p) => { const ativa = p.nome === recorde.patente; const c = patenteCor(p.nome); return (
            <div key={p.nome} className="flex-1 text-center rounded-[12px] py-2 px-1" style={{ background: ativa ? `${c}1a` : "#0a0a0d", border: `1px solid ${ativa ? c : "#22201a"}` }}>
              <p className="text-[15px] font-black" style={{ color: ativa ? c : "#fff" }}>{p.min}</p>
              <p className="text-[8px] font-extrabold tracking-[.04em]" style={{ color: ativa ? c : "#8a8378" }}>{p.nome}</p>
            </div>
          ); })}
        </div>
        <p className="text-[11px] mt-2" style={{ color: "#8a8378" }}>Vitórias. Cada patente libera aposta maior e aparece no seu nome na arena. Amistoso conta igual.</p>
      </Card>

      {/* histórico */}
      {historico.length > 0 && (
        <Card className="px-3.5 py-1">
          <Mini className="pt-2.5">ÚLTIMOS DUELOS</Mini>
          {historico.map((c) => {
            const ele = pessoa(outro(c)); const res = resultadoDe(c, uid);
            const cor = res === "vitoria" ? OK : res === "derrota" ? "#ff7d8c" : "#b3ab9c";
            return (
              <div key={c.id} className="flex items-center gap-2.5 py-2.5" style={{ borderTop: "1px solid #22201a" }}>
                <X1Avatar url={ele.avatar_url} nome={ele.nome} size={32} cor={cor} />
                <div className="flex-1 min-w-0"><p className="text-[12.5px] font-black truncate">{res === "vitoria" ? "Venceu" : res === "derrota" ? "Perdeu pra" : "Empatou com"} {primeiroNome(ele.nome)}</p><p className="text-[11px]" style={{ color: "#8a8378" }}>{quandoTexto(c.scheduled_date)} · {c.stakes_amount > 0 ? `${fmt(c.stakes_amount)} cada` : "amistoso"}</p></div>
                {res === "vitoria" ? <Trophy className="w-4 h-4" style={{ color: GOLD }} strokeWidth={2.4} /> : null}
                <Botao onClick={() => setSheet({ alvo: { user_id: ele.user_id, nome: ele.nome, avatar_url: ele.avatar_url }, quando: "amanha" })}>revanche</Botao>
              </div>
            );
          })}
        </Card>
      )}

      {/* 7. CTA fixo */}
      <div className="fixed left-0 right-0 z-[40] px-4" style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}>
        <div className="max-w-2xl mx-auto">
          <button type="button" onClick={() => setSheet({ alvo: null, quando: "hoje" })} disabled={!!minhaAberta} className="w-full h-[52px] rounded-[14px] inline-flex items-center justify-center gap-2 text-[15px] font-black tracking-[.04em] active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{ background: "linear-gradient(160deg,#7f1d1d,#450a0a)", color: "#fecaca", border: "1px solid #ef444499", boxShadow: "0 0 24px #ef444433" }}>
            <Swords className="w-5 h-5" strokeWidth={2.6} /> {minhaAberta ? "SUA CHAMADA ESTÁ NO AR" : "ABRIR CHAMADA GERAL"}
          </button>
        </div>
      </div>

      <ChamarSheet open={!!sheet} onOpenChange={(o) => { if (!o) setSheet(null); }} alvo={sheet?.alvo ?? null} eu={eu_} recorde={recorde} quandoInicial={sheet?.quando ?? "hoje"} onCriado={carregar} />
      {resultado && <X1ResultadoCard r={resultado.r} eu={eu_} ele={resultado.ele} recorde={recorde} onFechar={fecharResultado} onRevanche={revanche} />}
    </div>
  );
}
