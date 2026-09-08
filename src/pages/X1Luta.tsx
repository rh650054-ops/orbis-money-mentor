/* ============================================================
   A LUTA (/x1/luta/:id) — a tela inteira é o placar.
   • pending  → esperando aceite (ou "te desafiou → LUTAR")
   • active   → dois cards de lutador + VS, barras de energia, rodada do dia,
                últimos golpes (vendas do DEFCON), torcida; CTA VENDER
   • finished → tela de VITÓRIA/DERROTA animada (participante) ou resumo
   Espectador vê tudo e pode torcer. Atualiza a cada 15 s. Sem API externa.
   Todo hook acima do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Wallet, Flame, Check, X, Loader2, Swords, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import "@/components/x1/x1.css";
import { X1Avatar } from "@/components/x1/X1Avatar";
import { FighterCardLuta } from "@/components/x1/FighterCard";
import { VitoriaScreen } from "@/components/x1/VitoriaScreen";
import { fmt, primeiroNome, horaBR, rodadaAgora, horasAteMeiaNoite, erroBonito, expiraEm, carregarRecorde, voltaPraVoce, chaveVisto, type Pessoa, type Recorde, RECORDE_VAZIO } from "@/components/x1/x1-lib";

const GOLD = "#F5B800";
const RED = "#F2465A";
const OK = "#3DD68C";

interface Luta { id: string; status: string; scheduled_date: string; stakes_amount: number; prize_amount: number; winner_user_id: string | null; last_proposed_by: string | null; expires_at: string | null;
  challenger_id: string; ch_nome: string; ch_avatar: string | null; ch_total: number; ch_patente: string; ch_vitorias: number; ch_potencia: number;
  opponent_id: string; op_nome: string; op_avatar: string | null; op_total: number; op_patente: string; op_vitorias: number; op_potencia: number;
  torcida_ch: number; torcida_op: number; minha_torcida: string | null }
interface Golpe { user_id: string; amount: number; created_at: string }

export default function X1Luta() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const uid = user?.id;

  const [l, setL] = useState<Luta | null>(null);
  const [golpes, setGolpes] = useState<Golpe[]>([]);
  const [recorde, setRecorde] = useState<Recorde>(RECORDE_VAZIO);
  const [saldo, setSaldo] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [agindo, setAgindo] = useState(false);
  const [hit, setHit] = useState<"ch" | "op" | null>(null);
  const [rodadaVisivel, setRodadaVisivel] = useState(true);
  const [resultadoFechado, setResultadoFechado] = useState(false);
  const prev = useRef<{ ch: number; op: number } | null>(null);

  const carregar = useCallback(async () => {
    if (!id || !uid) return;
    const [{ data, error }, g] = await Promise.all([(supabase as any).rpc("x1_luta", { p_id: id }), (supabase as any).rpc("x1_golpes", { p_id: id })]);
    const row = ((data as any[]) || [])[0];
    if (error || !row) { setErro("Essa luta não existe mais."); return; }
    const nova: Luta = { ...row, stakes_amount: Number(row.stakes_amount) || 0, prize_amount: Number(row.prize_amount) || 0, ch_total: Number(row.ch_total) || 0, op_total: Number(row.op_total) || 0, ch_potencia: Number(row.ch_potencia) || 0, op_potencia: Number(row.op_potencia) || 0 };
    // golpe novo → sacode a barra e pula o número
    if (prev.current) {
      if (nova.ch_total > prev.current.ch) setHit("ch");
      else if (nova.op_total > prev.current.op) setHit("op");
    }
    prev.current = { ch: nova.ch_total, op: nova.op_total };
    setL(nova);
    setGolpes(((g.data as any[]) || []).map((x) => ({ ...x, amount: Number(x.amount) || 0 })) as Golpe[]);
  }, [id, uid]);

  useEffect(() => { void carregar(); const t = setInterval(carregar, 15000); return () => clearInterval(t); }, [carregar]);
  useEffect(() => {
    if (!uid) return;
    carregarRecorde(uid).then(setRecorde);
    supabase.from("x1_wallets" as any).select("balance").eq("user_id", uid).maybeSingle().then(({ data }) => setSaldo(Number((data as any)?.balance) || 0));
  }, [uid, l?.status]);
  useEffect(() => { if (!hit) return; try { navigator.vibrate?.(40); } catch { /* */ } const t = setTimeout(() => setHit(null), 500); return () => clearTimeout(t); }, [hit]);
  useEffect(() => { const t = setTimeout(() => setRodadaVisivel(false), 2600); return () => clearTimeout(t); }, []);

  const souCh = !!l && l.challenger_id === uid;
  const souOp = !!l && l.opponent_id === uid;
  const participo = souCh || souOp;
  const eu = useMemo<Pessoa | null>(() => (l ? (souOp ? { user_id: l.opponent_id, nome: l.op_nome, avatar_url: l.op_avatar } : { user_id: l.challenger_id, nome: l.ch_nome, avatar_url: l.ch_avatar }) : null), [l, souOp]);
  const ele = useMemo<Pessoa | null>(() => (l ? (souOp ? { user_id: l.challenger_id, nome: l.ch_nome, avatar_url: l.ch_avatar } : { user_id: l.opponent_id, nome: l.op_nome, avatar_url: l.op_avatar }) : null), [l, souOp]);

  const responder = async (action: "accept" | "decline") => {
    if (!l) return;
    setAgindo(true);
    const { error } = await (supabase as any).rpc("x1_negotiate", { p_id: l.id, p_action: action });
    setAgindo(false);
    if (error) { toast({ title: "Não rolou", description: erroBonito(error.message), variant: "destructive" }); return; }
    if (action === "accept") { try { navigator.vibrate?.([70, 40, 70, 40, 140]); } catch { /* */ } prev.current = null; void carregar(); }
    else { toast({ title: "Desafio recusado" }); navigate("/x1"); }
  };
  const torcer = async (lado: "challenger" | "opponent") => {
    if (!l) return;
    const { error } = await (supabase as any).rpc("x1_torcer", { p_id: l.id, p_lado: lado });
    if (error) { toast({ title: "Não rolou", description: erroBonito(error.message), variant: "destructive" }); return; }
    void carregar();
  };
  const compartilhar = async () => {
    if (!l) return;
    const texto = `X1 ao vivo no Orbis: ${primeiroNome(l.ch_nome)} ${fmt(l.ch_total)} × ${fmt(l.op_total)} ${primeiroNome(l.op_nome)}. Quem vende mais até 23:59 leva.`;
    try { if (navigator.share) await navigator.share({ text: texto }); else { await navigator.clipboard.writeText(texto); toast({ title: "Copiado!" }); } } catch { /* */ }
  };

  if (!uid) return null;
  if (erro) return <div className="min-h-screen px-6 pt-20 text-center" style={{ background: "#000" }}><p className="text-[15px] font-black">{erro}</p><button type="button" onClick={() => navigate("/x1")} className="x1-btn ouro mt-4">VOLTAR PRA ARENA</button></div>;
  if (!l || !eu || !ele) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#000" }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#8a8378" }} /></div>;

  const meu = souOp ? l.op_total : l.ch_total;
  const dele = souOp ? l.ch_total : l.op_total;
  const chLidera = l.ch_total > l.op_total; const opLidera = l.op_total > l.ch_total;
  const total = l.ch_total + l.op_total;
  const pctCh = total > 0 ? Math.round((l.ch_total / total) * 100) : 50;
  const rodada = rodadaAgora();
  const golpeDe = (g: Golpe) => (g.user_id === l.challenger_id ? l.ch_nome : l.op_nome);
  const tipoResultado: "vitoria" | "derrota" | "empate" = l.winner_user_id === uid ? "vitoria" : l.winner_user_id ? "derrota" : "empate";

  // ===== FINALIZADA =====
  if (l.status === "finished" && participo && !resultadoFechado && !localStorage.getItem(chaveVisto(l.id))) {
    return <VitoriaScreen tipo={tipoResultado} eu={eu} ele={ele} recorde={recorde} meu={meu} dele={dele} aposta={l.stakes_amount} premio={l.prize_amount}
      onFechar={() => { localStorage.setItem(chaveVisto(l.id), "1"); setResultadoFechado(true); }}
      onProximo={() => { localStorage.setItem(chaveVisto(l.id), "1"); navigate("/x1/escolher"); }}
      onRevanche={() => { localStorage.setItem(chaveVisto(l.id), "1"); navigate(`/x1/escolher?alvo=${ele.user_id}`); }} />;
  }

  const Topo = (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => navigate("/x1")} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#b3ab9c" }}><ArrowLeft className="w-5 h-5" /></button>
      {l.status === "active" ? (
        <span className="flex-1 inline-flex items-center gap-2 text-[10px] font-black tracking-[.14em]" style={{ color: "#ff7d8c" }}><i className="w-[7px] h-[7px] rounded-full x1-live" style={{ background: RED }} /> AO VIVO · RODADA {rodada} DE 6</span>
      ) : <span className="flex-1 text-[10px] font-black tracking-[.14em]" style={{ color: "#8a8378" }}>{l.status === "finished" ? "LUTA FECHADA" : l.status === "pending" ? "DESAFIO" : "ENCERRADA"}</span>}
      {participo ? (
        <button type="button" onClick={() => navigate("/x1/carteira")} className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-black" style={{ background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD }}><Wallet className="w-3.5 h-3.5" strokeWidth={2.6} /> {fmt(saldo)}</button>
      ) : (
        <span className="h-8 px-3 rounded-full inline-flex items-center text-[10px] font-black" style={{ background: "#1a1305", border: "1px solid #3a2f0c", color: GOLD }}>{l.stakes_amount > 0 ? `VOLTA ${fmt(voltaPraVoce(l.stakes_amount))}` : "AMISTOSO"}</span>
      )}
    </div>
  );

  // ===== PENDENTE =====
  if (l.status === "pending") {
    const minhaVez = participo && l.last_proposed_by !== uid;
    return (
      <div className="min-h-screen px-4 pt-3 pb-24 max-w-2xl mx-auto" style={{ background: "radial-gradient(100% 50% at 50% 30%,#1a0508,#000 70%)" }}>
        {Topo}
        <div className="flex items-center justify-center gap-4 mt-10">
          <div className="x1-slam"><X1Avatar url={l.ch_avatar} nome={l.ch_nome} size={96} cor={GOLD} style={{ borderWidth: 3 }} /></div>
          <span className="x1-vs x1-vs-glow text-[40px] font-black italic" style={{ color: GOLD, animationDelay: ".2s" }}>VS</span>
          <div className="x1-slam" style={{ animationDelay: ".1s" }}><X1Avatar url={l.op_avatar} nome={l.op_nome} size={96} cor={RED} style={{ borderWidth: 3 }} /></div>
        </div>
        <p className="x1-up text-center text-[22px] font-black mt-6 tracking-tight" style={{ "--i": 6 } as React.CSSProperties}>{primeiroNome(l.ch_nome)} × {primeiroNome(l.op_nome)}</p>
        <p className="x1-up text-center text-[12.5px] mt-1" style={{ "--i": 8, color: "#b3ab9c" } as React.CSSProperties}>
          Hoje · quem vende mais até 23:59 · {l.stakes_amount > 0 ? `valendo ${fmt(l.stakes_amount)} → volta ${fmt(voltaPraVoce(l.stakes_amount))}` : "amistoso · vale XP"} · {expiraEm(l.expires_at)}
        </p>
        {minhaVez ? (
          <div className="mt-8 space-y-2 x1-up" style={{ "--i": 10 } as React.CSSProperties}>
            <button type="button" disabled={agindo} onClick={() => responder("accept")} className="x1-btn ouro x1-pulse">{agindo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" strokeWidth={3} />} LUTAR · ACEITAR</button>
            <button type="button" disabled={agindo} onClick={() => responder("decline")} className="x1-btn fantasma"><X className="w-4 h-4" strokeWidth={3} /> Hoje não</button>
            {l.stakes_amount > saldo && l.stakes_amount > 0 && <p className="text-[11px] text-center" style={{ color: "#ff7d8c" }}>Falta saldo pra {fmt(l.stakes_amount)}. Deposite na carteira ou peça amistoso.</p>}
          </div>
        ) : (
          <div className="mt-8 rounded-[20px] border p-4 text-center x1-up" style={{ "--i": 10, background: "#0e0e10", borderColor: "#22201a" } as React.CSSProperties}>
            <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: GOLD }} />
            <p className="text-[14px] font-black mt-2">{participo ? `Esperando ${primeiroNome(ele.nome)} aceitar` : "Ainda não começou"}</p>
            <p className="text-[11.5px] mt-1" style={{ color: "#8a8378" }}>{participo ? "Ele recebeu com a sua foto. Assim que aceitar, a luta abre aqui — pode ir vender enquanto isso." : "O desafiado ainda não aceitou."}</p>
            {participo && <button type="button" onClick={() => navigate("/defcon")} className="x1-btn vermelho mt-4"><Flame className="w-5 h-5" strokeWidth={2.6} /> IR VENDER · DEFCON</button>}
          </div>
        )}
      </div>
    );
  }

  // ===== ENCERRADA SEM LUTA =====
  if (l.status !== "active" && l.status !== "finished") {
    return (
      <div className="min-h-screen px-4 pt-3 max-w-2xl mx-auto" style={{ background: "#000" }}>{Topo}
        <div className="rounded-[20px] border p-5 text-center mt-8" style={{ background: "#0e0e10", borderColor: "#22201a" }}>
          <p className="text-[14px] font-black">{l.status === "declined" ? "Desafio recusado" : l.status === "awaiting_result" ? "Resultado em revisão" : "Esse desafio expirou"}</p>
          <p className="text-[11.5px] mt-1" style={{ color: "#8a8378" }}>{l.status === "awaiting_result" ? "Duelo com dinheiro e número fora do padrão: o admin confere antes de pagar." : "Chama outro oponente — a arena tá cheia."}</p>
          <button type="button" onClick={() => navigate("/x1/escolher")} className="x1-btn ouro mt-4"><Swords className="w-5 h-5" strokeWidth={2.6} /> ESCOLHER OPONENTE</button>
        </div>
      </div>
    );
  }

  // ===== AO VIVO / FECHADA (placar) =====
  const fechada = l.status === "finished";
  return (
    <div className="min-h-screen px-4 pt-3 pb-28 max-w-2xl mx-auto relative overflow-hidden" style={{ background: "radial-gradient(100% 50% at 50% 30%,#1a0508,#000 70%)" }}>
      {Topo}
      {!fechada && rodadaVisivel && (
        <div className="x1-round absolute left-0 right-0 top-16 z-[5] flex justify-center pointer-events-none">
          <span className="rounded-full px-5 py-2 text-[14px] font-black italic tracking-[.1em]" style={{ background: "linear-gradient(180deg,#FFC63A,#F5B800)", color: "#1a1305", boxShadow: "0 6px 0 #B88700" }}>RODADA {rodada}</span>
        </div>
      )}

      <div className="flex items-start gap-2 mt-3">
        <FighterCardLuta className="x1-slam" nome={l.ch_nome} avatar={l.ch_avatar} patente={l.ch_patente} total={l.ch_total} lado={souOp ? "ele" : "eu"} lidera={chLidera} />
        <span className="x1-vs x1-vs-glow text-[34px] font-black italic mt-14" style={{ color: GOLD, animationDelay: ".2s" }}>VS</span>
        <FighterCardLuta className="x1-slam" nome={l.op_nome} avatar={l.op_avatar} patente={l.op_patente} total={l.op_total} lado={souOp ? "eu" : "ele"} lidera={opLidera} />
      </div>

      {/* ENERGIA */}
      <div className="mt-3 x1-up" style={{ "--i": 3 } as React.CSSProperties}>
        <div className="flex items-center justify-between text-[10px] font-black tracking-[.14em]">
          <span style={{ color: souOp ? "#ff7d8c" : OK }}>{souOp ? "ENERGIA DELE" : participo ? "SUA ENERGIA" : primeiroNome(l.ch_nome).toUpperCase()}</span>
          <span style={{ color: souOp ? OK : "#ff7d8c" }}>{souOp ? "SUA ENERGIA" : participo ? "ENERGIA DELE" : primeiroNome(l.op_nome).toUpperCase()}</span>
        </div>
        <div className="flex gap-1.5 mt-1.5">
          <div className={`flex-1 h-[14px] rounded-[7px] overflow-hidden ${hit === "ch" ? "x1-hit" : ""}`} style={{ background: "#1a0a0e", border: "1px solid rgba(255,255,255,.08)" }}><i className="block h-full rounded-[7px] transition-all duration-700" style={{ width: `${pctCh}%`, background: "linear-gradient(90deg,#1f8f5c,#3DD68C)", boxShadow: "0 0 14px #3DD68C88" }} /></div>
          <div className={`flex-1 h-[14px] rounded-[7px] overflow-hidden ${hit === "op" ? "x1-hit" : ""}`} style={{ background: "#1a0a0e", border: "1px solid rgba(255,255,255,.08)" }}><i className="block h-full rounded-[7px] ml-auto transition-all duration-700" style={{ width: `${100 - pctCh}%`, background: "linear-gradient(90deg,#c8172f,#ff5a6e)", boxShadow: "0 0 14px #F2465A88" }} /></div>
        </div>
        <p className="text-[12px] text-center mt-2" style={{ color: "#e9e4d8" }}>
          {fechada ? (
            <b style={{ color: GOLD }}>{l.winner_user_id ? `${primeiroNome(l.winner_user_id === l.challenger_id ? l.ch_nome : l.op_nome)} venceu por ${fmt(Math.abs(l.ch_total - l.op_total))}` : "Empate"}</b>
          ) : participo ? (
            <><b style={{ color: meu > dele ? OK : dele > meu ? "#ff7d8c" : "#b3ab9c" }}>{meu > dele ? `Você lidera por ${fmt(meu - dele)}.` : dele > meu ? `${primeiroNome(ele.nome)} lidera por ${fmt(dele - meu)}.` : "Empatados."}</b> Cada venda é um golpe. Faltam {horasAteMeiaNoite()}h.</>
          ) : (
            <><b style={{ color: GOLD }}>{chLidera ? `${primeiroNome(l.ch_nome)} lidera por ${fmt(l.ch_total - l.op_total)}.` : opLidera ? `${primeiroNome(l.op_nome)} lidera por ${fmt(l.op_total - l.ch_total)}.` : "Empatados."}</b> Fecha 23:59.</>
          )}
        </p>
      </div>

      {/* GOLPES */}
      <div className="rounded-[20px] border px-3.5 py-3 mt-3 x1-up" style={{ "--i": 5, background: "rgba(11,11,13,.85)", borderColor: "#22201a" } as React.CSSProperties}>
        <p className="text-[10px] font-black tracking-[.16em] mb-1" style={{ color: "#8a8378" }}>ÚLTIMOS GOLPES</p>
        {golpes.length === 0 && <p className="text-[11.5px] py-2" style={{ color: "#8a8378" }}>Nenhum golpe ainda. A primeira venda no DEFCON abre o placar.</p>}
        {golpes.slice(0, 6).map((g, i) => { const doCh = g.user_id === l.challenger_id; const meuGolpe = g.user_id === uid; return (
          <div key={`${g.created_at}-${i}`} className="flex items-center gap-2.5 py-2" style={{ borderTop: "1px solid #22201a" }}>
            <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold tabular-nums ${i === 0 && hit ? "x1-pop" : ""}`} style={doCh ? { background: souOp ? "#2a0c11" : "#0d1f16", border: `1px solid ${souOp ? RED : OK}66`, color: souOp ? "#ff7d8c" : OK } : { background: souOp ? "#0d1f16" : "#2a0c11", border: `1px solid ${souOp ? OK : RED}66`, color: souOp ? OK : "#ff7d8c" }}>+{fmt(g.amount)}</span>
            <p className="text-[12px]" style={{ color: "#e9e4d8" }}>{meuGolpe ? "Você" : primeiroNome(golpeDe(g))} · {horaBR(g.created_at)}</p>
          </div>
        ); })}
      </div>

      {/* TORCIDA */}
      <div className="flex items-center justify-center gap-2 mt-3 x1-up" style={{ "--i": 7 } as React.CSSProperties}>
        {participo ? (
          <span className="rounded-full px-3 py-1.5 text-[10.5px] font-extrabold" style={{ background: "#2a1405", border: "1px solid #ff7a1a66", color: "#ff7a1a" }}>Torcida {souOp ? `${l.torcida_op} × ${l.torcida_ch}` : `${l.torcida_ch} × ${l.torcida_op}`}</span>
        ) : !fechada ? (
          <>
            <button type="button" onClick={() => torcer("challenger")} className="flex-1 h-10 rounded-[12px] text-[11.5px] font-black" style={l.minha_torcida === "challenger" ? { background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD } : { background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>Torço pro {primeiroNome(l.ch_nome)} · {l.torcida_ch}</button>
            <button type="button" onClick={() => torcer("opponent")} className="flex-1 h-10 rounded-[12px] text-[11.5px] font-black" style={l.minha_torcida === "opponent" ? { background: "#2a0c11", border: `1px solid ${RED}`, color: "#ff7d8c" } : { background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>Torço pra {primeiroNome(l.op_nome)} · {l.torcida_op}</button>
          </>
        ) : null}
        <button type="button" onClick={compartilhar} aria-label="Compartilhar" className="w-10 h-10 rounded-[12px] inline-flex items-center justify-center shrink-0" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}><Share2 className="w-4 h-4" strokeWidth={2.6} /></button>
      </div>

      <div className="fixed left-0 right-0 z-[40] px-4" style={{ bottom: "calc(env(safe-area-inset-bottom) + 74px)" }}>
        <div className="max-w-2xl mx-auto">
          {fechada ? (
            <button type="button" onClick={() => navigate("/x1/escolher")} className="x1-btn ouro"><Swords className="w-5 h-5" strokeWidth={2.6} /> PRÓXIMO OPONENTE</button>
          ) : participo ? (
            <button type="button" onClick={() => navigate("/defcon")} className="x1-btn vermelho x1-pulse"><Flame className="w-5 h-5" strokeWidth={2.6} /> DAR UM GOLPE · VENDER</button>
          ) : (
            <button type="button" onClick={() => navigate("/x1/escolher")} className="x1-btn ouro"><Swords className="w-5 h-5" strokeWidth={2.6} /> QUERO LUTAR TAMBÉM</button>
          )}
        </div>
      </div>
    </div>
  );
}
