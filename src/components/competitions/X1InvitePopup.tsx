/* ============================================================
   "VOCÊ FOI DESAFIADO" — tela cheia, 1 toque (Rick, 08/09/2026).
   Aparece ao abrir o app quando há convite esperando a SUA resposta
   (status='pending' e a última proposta não foi sua). Fotos reais.
     LUTAR · ACEITAR   → x1_negotiate(accept)  (aposta sai da carteira na hora)
     honra só         → x1_negotiate(counter, stakes 0)  (só quando tem dinheiro)
     ✕                → x1_negotiate(decline)
   Anti-spam: o MESMO convite não reabre antes de 10 min (localStorage).
   Todo hook acima do primeiro return.
   ============================================================ */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Check, X, Handshake, Loader2, Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/shared/hooks/use-toast";
import { X1Avatar } from "@/components/x1/X1Avatar";
import { carregarPessoas, carregarRecorde, erroBonito, expiraEm, fmt, primeiroNome, quandoTexto, type Pessoa } from "@/components/x1/x1-lib";

const COOLDOWN_MS = 10 * 60 * 1000;
const GOLD = "#F5B800";
const RED = "#F2465A";

interface Convite { id: string; challenger_id: string; opponent_id: string; scheduled_date: string | null; stakes_amount: number; last_proposed_by: string | null; expires_at: string | null }

export default function X1InvitePopup({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [convite, setConvite] = useState<Convite | null>(null);
  const [ele, setEle] = useState<Pessoa | null>(null);
  const [eu, setEu] = useState<Pessoa | null>(null);
  const [vits, setVits] = useState<{ eu: number; ele: number }>({ eu: 0, ele: 0 });
  const [saldo, setSaldo] = useState(0);
  const [agindo, setAgindo] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from("x1_challenges" as any)
        .select("id, challenger_id, opponent_id, scheduled_date, stakes_amount, last_proposed_by, expires_at")
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
        .eq("status", "pending").order("created_at", { ascending: false }).limit(5);
      const rows = ((data as any[]) || []) as Convite[];
      const meu = rows.find((c) => c.last_proposed_by !== userId);
      if (!meu || !vivo) return;
      const ts = Number(localStorage.getItem(`x1invite_ts_${meu.id}`) || 0);
      if (Date.now() - ts < COOLDOWN_MS) return;
      const outroId = meu.challenger_id === userId ? meu.opponent_id : meu.challenger_id;
      const [m, rEu, rEle, w] = await Promise.all([
        carregarPessoas([userId, outroId]), carregarRecorde(userId), carregarRecorde(outroId),
        supabase.from("x1_wallets" as any).select("balance").eq("user_id", userId).maybeSingle(),
      ]);
      if (!vivo) return;
      setEu(m[userId] || { user_id: userId, nome: "Você", avatar_url: null });
      setEle(m[outroId] || { user_id: outroId, nome: "Vendedor", avatar_url: null });
      setVits({ eu: rEu.vitorias, ele: rEle.vitorias });
      setSaldo(Number((w.data as any)?.balance) || 0);
      localStorage.setItem(`x1invite_ts_${meu.id}`, String(Date.now()));
      setConvite({ ...meu, stakes_amount: Number(meu.stakes_amount) || 0 });
      setAberto(true);
    })().catch(() => {});
    return () => { vivo = false; };
  }, [userId]);

  if (!aberto || !convite || !ele || !eu) return null;

  const fechar = () => { localStorage.setItem(`x1invite_ts_${convite.id}`, String(Date.now())); setAberto(false); };
  const rpc = async (chave: string, action: string, stakes: number | null, ok: string, depois?: () => void) => {
    setAgindo(chave);
    const { error } = await (supabase as any).rpc("x1_negotiate", { p_id: convite.id, p_action: action, p_stakes: stakes });
    setAgindo(null);
    if (error) { toast({ title: "Não rolou", description: erroBonito(error.message), variant: "destructive" }); return; }
    toast({ title: ok });
    fechar();
    depois?.();
  };
  const nome = primeiroNome(ele.nome);
  const aposta = convite.stakes_amount;
  const semSaldo = aposta > 0 && saldo < aposta;

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.88)" }}>
      <div className="orbis-card-in w-full max-w-sm rounded-[26px] text-center px-5 pt-6 pb-5 relative overflow-hidden"
        style={{ background: "radial-gradient(120% 90% at 50% 0%,#2a0c11 0%,#140508 45%,#0b0b0d 100%)", border: `1px solid ${RED}66`, boxShadow: `0 30px 80px -30px ${RED}88` }}>
        <button type="button" onClick={fechar} aria-label="Depois" className="absolute right-3 top-3 w-8 h-8 rounded-full flex items-center justify-center" style={{ color: "rgba(255,255,255,.5)" }}><X className="w-4 h-4" /></button>
        <p className="text-[10px] font-black tracking-[.18em]" style={{ color: "#ff7d8c" }}>VOCÊ FOI DESAFIADO</p>

        <div className="flex items-center justify-center gap-4 mt-4">
          <div>
            <X1Avatar url={ele.avatar_url} nome={ele.nome} size={68} cor={RED} />
            <p className="text-[10.5px] font-black tracking-[.1em] mt-1.5" style={{ color: "#ff7d8c" }}>{nome.toUpperCase()} · {vits.ele}V</p>
          </div>
          <span className="text-[28px] font-black italic" style={{ color: GOLD, textShadow: `0 0 18px ${GOLD}88` }}>VS</span>
          <div>
            <X1Avatar url={eu.avatar_url} nome={eu.nome} size={68} cor={GOLD} />
            <p className="text-[10.5px] font-black tracking-[.1em] mt-1.5" style={{ color: GOLD }}>VOCÊ · {vits.eu}V</p>
          </div>
        </div>

        <p className="text-[19px] font-black leading-tight mt-4">{quandoTexto(convite.scheduled_date) === "hoje" ? "Hoje" : quandoTexto(convite.scheduled_date) === "amanhã" ? "Amanhã" : quandoTexto(convite.scheduled_date)} · quem fatura mais<br />
          <span style={{ color: GOLD }}>{aposta > 0 ? `valendo ${fmt(aposta)} cada` : "amistoso · só honra"}</span></p>
        <p className="text-[11.5px] mt-1.5" style={{ color: "#b3ab9c" }}>
          {vits.ele > 0 ? `${nome} já venceu ${vits.ele}. ` : `Primeiro duelo de ${nome}. `}
          {aposta > 0 ? `Você tem ${fmt(saldo)} na carteira. ` : "Conta pelo DEFCON, fecha 23:59. "}
          {expiraEm(convite.expires_at)}.
        </p>

        <div className="flex gap-2 mt-4">
          <button type="button" disabled={!!agindo || semSaldo} onClick={() => rpc("ok", "accept", null, "Luta aberta! Vai vender.", () => navigate(`/x1/luta/${convite.id}`))} className="orbis-cta flex-[1.5] h-[48px] disabled:opacity-50">
            {agindo === "ok" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={3} />} LUTAR · ACEITAR
          </button>
          {aposta > 0 && (
            <button type="button" disabled={!!agindo} onClick={() => rpc("honra", "counter", 0, "Proposta de amistoso enviada")} className="flex-1 h-[48px] rounded-[13px] text-[11.5px] font-black inline-flex items-center justify-center gap-1" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
              {agindo === "honra" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Handshake className="w-4 h-4" strokeWidth={2.6} />} honra só
            </button>
          )}
          <button type="button" disabled={!!agindo} onClick={() => rpc("nao", "decline", null, "Desafio recusado")} aria-label="Recusar" className="w-[46px] h-[48px] rounded-[13px] inline-flex items-center justify-center" style={{ background: "#2a0c11", border: `1px solid ${RED}66`, color: "#ff7d8c" }}>
            {agindo === "nao" ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" strokeWidth={3} />}
          </button>
        </div>
        {semSaldo && (
          <button type="button" onClick={() => { fechar(); navigate("/x1/carteira"); }} className="mt-2.5 text-[11.5px] font-bold inline-flex items-center gap-1" style={{ color: GOLD }}>
            <Swords className="w-3.5 h-3.5" /> Falta saldo pra {fmt(aposta)} · depositar ou topar na honra
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
