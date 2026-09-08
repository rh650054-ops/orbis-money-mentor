/* ============================================================
   ARENA X1 — "jogo de luta" (Rick, 08/09/2026).
   Home da arena: seu CARD DE LUTADOR (foto, patente, XP), o que precisa de
   você agora (luta rolando / desafio recebido), MISSÕES DA SEMANA e o feed
   LUTAS AO VIVO. Carteira sempre no topo.
   Fluxo: ESCOLHER OPONENTE → /x1/escolher → LUTAR HOJE → /x1/luta/:id.
   Sem API externa. Todo hook acima do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Wallet, Swords, Check, X, Loader2, Flame, Trophy, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { getBrazilDate } from "@/shared/lib/date-utils";
import "@/components/x1/x1.css";
import { X1Avatar, X1Faces } from "@/components/x1/X1Avatar";
import { FighterCardArena } from "@/components/x1/FighterCard";
import { VitoriaScreen } from "@/components/x1/VitoriaScreen";
import { fmt, primeiroNome, quandoTexto, expiraEm, erroBonito, carregarRecorde, carregarPessoas, resultadoDe, chaveVisto, voltaPraVoce, type Duelo, type Pessoa, type Recorde, RECORDE_VAZIO } from "@/components/x1/x1-lib";

const GOLD = "#F5B800";
const RED = "#F2465A";
const OK = "#3DD68C";
const HOT = "#ff7a1a";

interface Missao { tipo: string; titulo: string; alvo: number; feito: number; concluida: boolean; dica: string }
interface LutaViva { id: string; challenger_id: string; ch_nome: string; ch_avatar: string | null; ch_total: number; opponent_id: string; op_nome: string; op_avatar: string | null; op_total: number; stakes_amount: number; prize_amount: number; torcida_ch: number; torcida_op: number; minha_luta: boolean }

function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`rounded-[20px] border p-3.5 ${className}`} style={{ background: "#0e0e10", borderColor: "#22201a", ...style }}>{children}</div>;
}
function Chip({ children, cor = "#e9e4d8", fundo = "#16151a", borda = "#2a2823" }: { children: React.ReactNode; cor?: string; fundo?: string; borda?: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold border whitespace-nowrap" style={{ background: fundo, borderColor: borda, color: cor }}>{children}</span>;
}

export default function X1() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const uid = user?.id;
  const hoje = getBrazilDate();

  const [eu, setEu] = useState<Pessoa | null>(null);
  const [recorde, setRecorde] = useState<Recorde>(RECORDE_VAZIO);
  const [arenaPos, setArenaPos] = useState<number | null>(null);
  const [saldo, setSaldo] = useState(0);
  const [duelos, setDuelos] = useState<Duelo[]>([]);
  const [pessoas, setPessoas] = useState<Record<string, Pessoa>>({});
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [vivas, setVivas] = useState<LutaViva[]>([]);
  const [oQueVendo, setOQueVendo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [agindo, setAgindo] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ d: Duelo; ele: Pessoa; meu: number; dele: number } | null>(null);

  // deep link antigo (?desafiar=uid) → seleção já com o alvo
  useEffect(() => {
    const alvo = params.get("desafiar");
    if (alvo) navigate(`/x1/escolher?alvo=${alvo}${params.get("quando") === "amanha" ? "&quando=amanha" : ""}`, { replace: true });
  }, [params, navigate]);

  const carregar = useCallback(async () => {
    if (!uid) return;
    const [rec, pos, w, d, ms, lv, pp] = await Promise.all([
      carregarRecorde(uid),
      (supabase as any).rpc("x1_arena_rank", { p_user: uid }),
      supabase.from("x1_wallets" as any).select("balance").eq("user_id", uid).maybeSingle(),
      supabase.from("x1_challenges" as any)
        .select("id, challenger_id, opponent_id, status, scheduled_date, stakes_amount, prize_amount, winner_user_id, last_proposed_by, tipo, expires_at, created_at, money_status")
        .or(`challenger_id.eq.${uid},opponent_id.eq.${uid}`).order("created_at", { ascending: false }).limit(30),
      (supabase as any).rpc("x1_missoes"),
      (supabase as any).rpc("x1_lutas_ao_vivo"),
      supabase.from("public_profiles").select("user_id, nickname, avatar_url, what_i_sell").eq("user_id", uid).maybeSingle(),
    ]);
    setRecorde(rec);
    setArenaPos(typeof pos.data === "number" && rec.duelos > 0 ? pos.data : null);
    setSaldo(Number((w.data as any)?.balance) || 0);
    const lista = ((d.data as any[]) || []).map((c) => ({ ...c, stakes_amount: Number(c.stakes_amount) || 0, prize_amount: Number(c.prize_amount) || 0 })) as Duelo[];
    setDuelos(lista);
    setMissoes(((ms.data as any[]) || []) as Missao[]);
    setVivas(((lv.data as any[]) || []).map((l) => ({ ...l, ch_total: Number(l.ch_total) || 0, op_total: Number(l.op_total) || 0, stakes_amount: Number(l.stakes_amount) || 0 })) as LutaViva[]);
    const p = pp.data as any;
    setEu({ user_id: uid, nome: p?.nickname || "Você", avatar_url: p?.avatar_url || null });
    setOQueVendo(p?.what_i_sell || null);
    setPessoas(await carregarPessoas(lista.flatMap((c) => [c.challenger_id, c.opponent_id || ""])));
    setCarregando(false);
  }, [uid]);
  useEffect(() => { void carregar(); }, [carregar]);
  // feed ao vivo se atualiza sozinho
  useEffect(() => {
    if (!uid) return;
    const t = setInterval(async () => {
      const { data } = await (supabase as any).rpc("x1_lutas_ao_vivo");
      setVivas(((data as any[]) || []).map((l) => ({ ...l, ch_total: Number(l.ch_total) || 0, op_total: Number(l.op_total) || 0, stakes_amount: Number(l.stakes_amount) || 0 })) as LutaViva[]);
    }, 30000);
    return () => clearInterval(t);
  }, [uid]);

  const outro = useCallback((c: Duelo) => (c.challenger_id === uid ? c.opponent_id || "" : c.challenger_id), [uid]);
  const pessoa = useCallback((id: string): Pessoa => pessoas[id] || { user_id: id, nome: "Vendedor", avatar_url: null }, [pessoas]);
  const minhaLuta = useMemo(() => duelos.find((c) => c.status === "active" && c.scheduled_date === hoje) || null, [duelos, hoje]);
  const desafios = useMemo(() => duelos.filter((c) => c.status === "pending" && c.last_proposed_by !== uid), [duelos, uid]);
  const esperando = useMemo(() => duelos.filter((c) => c.status === "pending" && c.last_proposed_by === uid), [duelos, uid]);
  const historico = useMemo(() => duelos.filter((c) => c.status === "finished").slice(0, 6), [duelos]);

  // resultado novo (48h, não visto) → tela de vitória/derrota
  useEffect(() => {
    if (!uid || duelos.length === 0) return;
    const limite = new Date(Date.now() - 48 * 3600 * 1000).toISOString().slice(0, 10);
    const novo = duelos.find((c) => c.status === "finished" && (c.scheduled_date || "") >= limite && !localStorage.getItem(chaveVisto(c.id)));
    if (!novo) return;
    let vivo = true;
    (supabase as any).rpc("x1_luta", { p_id: novo.id }).then(({ data }: { data: any[] | null }) => {
      const row = ((data as any[]) || [])[0];
      if (!vivo || !row) return;
      const iAmCh = novo.challenger_id === uid;
      setResultado({ d: novo, ele: pessoa(outro(novo)), meu: Number(iAmCh ? row.ch_total : row.op_total) || 0, dele: Number(iAmCh ? row.op_total : row.ch_total) || 0 });
    });
    return () => { vivo = false; };
  }, [uid, duelos, pessoa, outro]);

  const responder = async (c: Duelo, action: "accept" | "decline") => {
    setAgindo(c.id);
    const { error } = await (supabase as any).rpc("x1_negotiate", { p_id: c.id, p_action: action });
    setAgindo(null);
    if (error) { toast({ title: "Não rolou", description: erroBonito(error.message), variant: "destructive" }); return; }
    if (action === "accept") { try { navigator.vibrate?.([60, 40, 90]); } catch { /* sem vibração */ } navigate(`/x1/luta/${c.id}`); return; }
    toast({ title: "Desafio recusado" });
    void carregar();
  };

  if (!uid) return null;
  const eu_ = eu || { user_id: uid, nome: "Você", avatar_url: null };

  return (
    <div className="min-h-screen pb-28 px-4 pt-3 max-w-2xl mx-auto space-y-3" style={{ background: "#000" }}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate("/")} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#b3ab9c" }}><ArrowLeft className="w-5 h-5" /></button>
        <p className="flex-1 text-[11px] font-black tracking-[.2em]" style={{ color: "#8a8378" }}>ARENA X1</p>
        <button type="button" onClick={() => navigate("/x1/carteira")} className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-black active:scale-95 transition-transform" style={{ background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD }}>
          <Wallet className="w-3.5 h-3.5" strokeWidth={2.6} /> Carteira · {fmt(saldo)}
        </button>
      </div>

      {/* SEU CARD */}
      <FighterCardArena className="x1-slam" nome={eu_.nome} avatar={eu_.avatar_url} r={recorde} sub={oQueVendo} posicao={arenaPos} />

      {/* O QUE PRECISA DE VOCÊ AGORA */}
      {minhaLuta ? (
        <button type="button" onClick={() => navigate(`/x1/luta/${minhaLuta.id}`)} className="x1-btn vermelho x1-pulse x1-up" style={{ "--i": 1 } as React.CSSProperties}>
          <span className="w-2 h-2 rounded-full x1-live" style={{ background: "#fff" }} /> SUA LUTA TÁ ROLANDO · VER
        </button>
      ) : (
        <button type="button" onClick={() => navigate("/x1/escolher")} className="x1-btn ouro x1-pulse x1-up" style={{ "--i": 1 } as React.CSSProperties}>
          <Swords className="w-5 h-5" strokeWidth={2.6} /> ESCOLHER OPONENTE
        </button>
      )}

      {desafios.map((c, i) => { const ele = pessoa(outro(c)); const ocupado = agindo === c.id; return (
        <Card key={c.id} className="x1-up" style={{ "--i": 2 + i, borderColor: `${RED}66`, background: "linear-gradient(160deg,#2a0c11,#0e0e10)" } as React.CSSProperties}>
          <div className="flex items-center gap-2.5">
            <X1Avatar url={ele.avatar_url} nome={ele.nome} size={44} cor={RED} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black tracking-[.14em]" style={{ color: "#ff7d8c" }}>TE DESAFIOU</p>
              <p className="text-[15px] font-black truncate leading-tight">{primeiroNome(ele.nome)} quer lutar {quandoTexto(c.scheduled_date)}</p>
              <p className="text-[11px]" style={{ color: "#8a8378" }}>{c.stakes_amount > 0 ? `valendo ${fmt(c.stakes_amount)} · volta ${fmt(voltaPraVoce(c.stakes_amount))}` : "amistoso · vale XP"} · {expiraEm(c.expires_at)}</p>
            </div>
            <button type="button" disabled={ocupado} onClick={() => responder(c, "accept")} className="h-10 px-3.5 rounded-[12px] inline-flex items-center gap-1 text-[12.5px] font-black italic" style={{ background: "linear-gradient(180deg,#FFC63A,#F5B800)", color: "#1a1305", boxShadow: "0 4px 0 #B88700" }}>
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" strokeWidth={3} /> LUTAR</>}
            </button>
            <button type="button" disabled={ocupado} onClick={() => responder(c, "decline")} aria-label="Recusar" className="w-9 h-10 rounded-[12px] inline-flex items-center justify-center" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#8a8378" }}><X className="w-4 h-4" strokeWidth={3} /></button>
          </div>
        </Card>
      ); })}
      {esperando.map((c, i) => { const ele = pessoa(outro(c)); return (
        <Card key={c.id} className="flex items-center gap-3 x1-up" style={{ "--i": 3 + i } as React.CSSProperties}>
          <X1Avatar url={ele.avatar_url} nome={ele.nome} size={36} cor="#8a8378" />
          <div className="flex-1 min-w-0"><p className="text-[13px] font-black truncate">Esperando {primeiroNome(ele.nome)} aceitar</p><p className="text-[11px]" style={{ color: "#8a8378" }}>{quandoTexto(c.scheduled_date)} · {c.stakes_amount > 0 ? `${fmt(c.stakes_amount)} cada` : "amistoso"} · {expiraEm(c.expires_at)}</p></div>
          <Chip>ENVIADO</Chip>
        </Card>
      ); })}

      {/* MISSÕES */}
      <Card className="x1-up" style={{ "--i": 4 } as React.CSSProperties}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>MISSÕES DA SEMANA</p>
          <Chip cor={GOLD} fundo="#1a1305" borda="#3a2f0c">+2 XP cada</Chip>
        </div>
        <div className="mt-2">
          {missoes.map((m) => (
            <div key={m.tipo} className="flex items-center gap-2.5 py-2" style={{ borderTop: "1px solid #22201a" }}>
              <span className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[11px] font-black shrink-0" style={m.concluida ? { background: "#0d1f16", border: `1px solid ${OK}66`, color: OK } : { background: "#1a1305", border: "1px solid #3a2f0c", color: GOLD }}>
                {m.concluida ? <Check className="w-4 h-4" strokeWidth={3} /> : `${m.feito}/${m.alvo}`}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-black">{m.titulo}</p>
                {m.concluida ? <p className="text-[11px]" style={{ color: OK }}>feita · +2 XP</p> : (
                  <>
                    <div className="h-[6px] rounded-full overflow-hidden mt-1" style={{ background: "#1c1b20" }}><i className="block h-full" style={{ width: `${Math.round((m.feito / m.alvo) * 100)}%`, background: GOLD }} /></div>
                    <p className="text-[10.5px] mt-1" style={{ color: "#8a8378" }}>{m.dica}</p>
                  </>
                )}
              </div>
            </div>
          ))}
          {missoes.length === 0 && !carregando && <p className="text-[11.5px] py-2" style={{ color: "#8a8378" }}>As missões aparecem depois da sua primeira luta.</p>}
        </div>
      </Card>

      {/* LUTAS AO VIVO */}
      <Card className="x1-up px-3.5 py-3" style={{ "--i": 5 } as React.CSSProperties}>
        <div className="flex items-center justify-between mb-1">
          <span className="inline-flex items-center gap-2 text-[10px] font-black tracking-[.14em]" style={{ color: "#ff7d8c" }}><i className="w-[7px] h-[7px] rounded-full x1-live" style={{ background: RED }} /> LUTAS AO VIVO</span>
          <span className="text-[11px]" style={{ color: "#8a8378" }}>{vivas.length > 0 ? `${vivas.length} rolando` : "nenhuma agora"}</span>
        </div>
        {vivas.length === 0 && (
          <p className="text-[12px] py-2" style={{ color: "#8a8378" }}>Ninguém lutando neste momento. Escolhe um oponente e abre a arena — todo mundo vai ver.</p>
        )}
        {vivas.slice(0, 6).map((l) => {
          const chLidera = l.ch_total > l.op_total;
          return (
            <button key={l.id} type="button" onClick={() => navigate(`/x1/luta/${l.id}`)} className="w-full flex items-center gap-2.5 py-2.5 text-left" style={{ borderTop: "1px solid #22201a" }}>
              <X1Faces eu={{ url: l.ch_avatar, nome: l.ch_nome }} ele={{ url: l.op_avatar, nome: l.op_nome }} size={30} />
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-black truncate tabular-nums">
                  <span style={{ color: chLidera ? OK : "#fff" }}>{primeiroNome(l.ch_nome)} {Math.round(l.ch_total)}</span> <span style={{ color: GOLD }}>×</span> <span style={{ color: !chLidera && l.op_total > l.ch_total ? OK : "#fff" }}>{Math.round(l.op_total)} {primeiroNome(l.op_nome)}</span>
                </p>
                <p className="text-[10.5px] truncate" style={{ color: "#8a8378" }}>
                  {l.minha_luta ? "sua luta · " : ""}{l.stakes_amount > 0 ? `valendo ${fmt(l.stakes_amount)} · volta ${fmt(voltaPraVoce(l.stakes_amount))}` : "amistoso"}{l.torcida_ch + l.torcida_op > 0 ? ` · torcida ${l.torcida_ch} × ${l.torcida_op}` : ""}
                </p>
              </div>
              <Chip cor="#ff7d8c" fundo="#2a0c11" borda={`${RED}66`}>VER</Chip>
            </button>
          );
        })}
      </Card>

      {/* HISTÓRICO */}
      {historico.length > 0 && (
        <Card className="x1-up px-3.5 py-3" style={{ "--i": 6 } as React.CSSProperties}>
          <p className="text-[10px] font-black tracking-[.16em] mb-1" style={{ color: "#8a8378" }}>SUAS ÚLTIMAS LUTAS</p>
          {historico.map((c) => {
            const ele = pessoa(outro(c)); const res = resultadoDe(c, uid);
            const cor = res === "vitoria" ? OK : res === "derrota" ? "#ff7d8c" : "#b3ab9c";
            return (
              <button key={c.id} type="button" onClick={() => navigate(`/x1/luta/${c.id}`)} className="w-full flex items-center gap-2.5 py-2.5 text-left" style={{ borderTop: "1px solid #22201a" }}>
                <X1Avatar url={ele.avatar_url} nome={ele.nome} size={32} cor={cor} />
                <div className="flex-1 min-w-0"><p className="text-[12.5px] font-black truncate">{res === "vitoria" ? "Venceu" : res === "derrota" ? "Perdeu pra" : "Empatou com"} {primeiroNome(ele.nome)}</p><p className="text-[10.5px]" style={{ color: "#8a8378" }}>{quandoTexto(c.scheduled_date)} · {c.stakes_amount > 0 ? `${fmt(c.stakes_amount)} cada` : "amistoso"}</p></div>
                {res === "vitoria" ? <Trophy className="w-4 h-4" style={{ color: GOLD }} strokeWidth={2.4} /> : <ChevronRight className="w-4 h-4" style={{ color: "#8a8378" }} />}
              </button>
            );
          })}
        </Card>
      )}

      {carregando && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8a8378" }} /></div>}

      {!minhaLuta && (
        <button type="button" onClick={() => navigate("/defcon")} className="x1-btn fantasma x1-up" style={{ "--i": 7 } as React.CSSProperties}>
          <Flame className="w-4 h-4" strokeWidth={2.6} style={{ color: HOT }} /> Abrir o DEFCON (quem tá vendendo aparece "na arena")
        </button>
      )}

      {resultado && (
        <VitoriaScreen
          tipo={resultadoDe(resultado.d, uid)}
          eu={eu_} ele={resultado.ele} recorde={recorde}
          meu={resultado.meu} dele={resultado.dele} aposta={resultado.d.stakes_amount} premio={resultado.d.prize_amount}
          onFechar={() => { localStorage.setItem(chaveVisto(resultado.d.id), "1"); setResultado(null); }}
          onProximo={() => { localStorage.setItem(chaveVisto(resultado.d.id), "1"); setResultado(null); navigate("/x1/escolher"); }}
          onRevanche={() => { localStorage.setItem(chaveVisto(resultado.d.id), "1"); const id = resultado.ele.user_id; setResultado(null); navigate(`/x1/escolher?alvo=${id}`); }}
        />
      )}
    </div>
  );
}
