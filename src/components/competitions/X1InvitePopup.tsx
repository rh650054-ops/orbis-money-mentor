import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/shared/hooks/use-toast";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { Swords, Calendar, Target, Coins } from "lucide-react";
import { getBrazilDate } from "@/shared/lib/date-utils";
import PublicProfileModal from "@/components/PublicProfileModal";

// Anti-spam: intervalo mínimo pra reabrir o MESMO convite (vale entre todas as telas).
const COOLDOWN_MS = 10 * 60 * 1000; // 10 min

interface Challenge {
  id: string;
  challenger_id: string;
  opponent_id: string;
  status: string;
  modo: string | null;
  goal_amount: number | null;
  stakes_amount: number | null;
  scheduled_date: string | null;
  last_proposed_by: string | null;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const dateBR = (iso: string | null) => {
  if (!iso) return null;
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return iso;
  }
};

// Popup "te chamou pra um X1" que aparece ao abrir o app quando há um desafio
// pendente esperando a SUA resposta (status='pending' e a última proposta NÃO foi
// sua). Some depois de visto na mesma sessão (sessionStorage).
export default function X1InvitePopup({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [other, setOther] = useState<{ nome: string; avatar: string | null } | null>(null);
  const [me, setMe] = useState<{ nome: string; avatar: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [otherUid, setOtherUid] = useState<string | null>(null); // id do desafiante (pra abrir o perfil)
  const [profileUid, setProfileUid] = useState<string | null>(null); // perfil aberto por cima do convite

  // Contraproposta direto no popup.
  const [showCounter, setShowCounter] = useState(false);
  const [cModo, setCModo] = useState("");
  const [cDia, setCDia] = useState("");
  const [cMeta, setCMeta] = useState("");
  const [cAposta, setCAposta] = useState("0");
  const [cPix, setCPix] = useState("");
  const [cNome, setCNome] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("x1_challenges" as any)
        .select("id, challenger_id, opponent_id, status, modo, goal_amount, stakes_amount, scheduled_date, last_proposed_by")
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);
      const rows = ((data as any[]) || []) as Challenge[];
      // É a minha vez quando a última proposta não foi minha.
      const mine = rows.find((c) => c.last_proposed_by !== userId);
      if (!mine || !alive) return;
      // Anti-spam: não reabre o mesmo convite antes do cooldown (vale entre todas as telas).
      const ts = Number(localStorage.getItem(`x1invite_ts_${mine.id}`) || 0);
      if (Date.now() - ts < COOLDOWN_MS) return;

      // O proponente (quem mandou a bola) é o "outro": last_proposed_by, ou o outro participante.
      const otherId =
        mine.last_proposed_by && mine.last_proposed_by !== userId
          ? mine.last_proposed_by
          : mine.challenger_id === userId
            ? mine.opponent_id
            : mine.challenger_id;
      // Nome/avatar: usa o mesmo do ranking (leaderboard_stats, sempre preenchido) com reserva no public_profiles.
      const [{ data: ls }, { data: pp }] = await Promise.all([
        supabase.from("leaderboard_stats").select("user_id, nome_usuario, avatar_url").in("user_id", [otherId, userId]),
        supabase.from("public_profiles").select("user_id, nickname, avatar_url").in("user_id", [otherId, userId]),
      ]);
      if (!alive) return;
      const lsArr = (ls as any[]) || [];
      const ppArr = (pp as any[]) || [];
      const resolve = (uid: string, fallback: string) => {
        const a = lsArr.find((x) => x.user_id === uid);
        const b = ppArr.find((x) => x.user_id === uid);
        return { nome: a?.nome_usuario || b?.nickname || fallback, avatar: a?.avatar_url || b?.avatar_url || null };
      };
      setOther(resolve(otherId, "Vendedor"));
      setMe(resolve(userId, "Você"));
      setOtherUid(otherId);
      localStorage.setItem(`x1invite_ts_${mine.id}`, String(Date.now()));
      setChallenge(mine);
      setOpen(true);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!challenge || !other) return null;

  const markSeen = () => {
    // Reinicia o cooldown ao fechar (não incomoda de novo tão cedo).
    localStorage.setItem(`x1invite_ts_${challenge.id}`, String(Date.now()));
    setOpen(false);
  };

  const accept = () => {
    markSeen();
    navigate("/x1");
  };

  const decline = async () => {
    // Igual ao sendCounter: checa o erro da RPC antes de dizer que recusou —
    // antes o toast "Desafio recusado" aparecia mesmo se a chamada falhasse.
    const { error } = await (supabase as any).rpc("x1_negotiate", {
      p_id: challenge.id,
      p_action: "decline",
      p_pix: null,
      p_nome: null,
      p_modo: null,
      p_goal: null,
      p_stakes: null,
      p_date: null,
    });
    if (error) {
      toast({ title: "Erro ao recusar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Desafio recusado" });
    markSeen();
  };

  const openCounter = () => {
    setCModo(challenge.modo ?? "");
    setCDia(challenge.scheduled_date ?? getBrazilDate());
    setCMeta(challenge.goal_amount != null ? String(challenge.goal_amount) : "");
    setCAposta(challenge.stakes_amount != null ? String(challenge.stakes_amount) : "0");
    setCPix("");
    setCNome("");
    setShowCounter(true);
  };

  const sendCounter = async () => {
    const aposta = Number(String(cAposta).replace(",", ".")) || 0;
    if (aposta > 0 && (!cPix.trim() || !cNome.trim())) {
      toast({ title: "Faltou seu Pix", description: "Com aposta, informe sua chave Pix e o nome do titular.", variant: "destructive" });
      return;
    }
    setSending(true);
    const { error } = await (supabase as any).rpc("x1_negotiate", {
      p_id: challenge.id,
      p_action: "counter",
      p_pix: aposta > 0 ? cPix.trim() : null,
      p_nome: aposta > 0 ? cNome.trim() : null,
      p_modo: cModo.trim() || null,
      p_goal: cMeta ? Number(String(cMeta).replace(",", ".")) : null,
      p_stakes: aposta,
      p_date: cDia || null,
    });
    setSending(false);
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Contraproposta enviada! ⚔️", description: `Agora é a vez de ${other.nome} responder.` });
    markSeen();
  };

  const dia = dateBR(challenge.scheduled_date);
  const stakes = challenge.stakes_amount ?? 0;
  const cApostaNum = Number(String(cAposta).replace(",", ".")) || 0;

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && markSeen()}>
      <DialogContent
        className="max-w-sm rounded-[28px] border-amber-500/40 bg-[#0c0c0f] p-0 overflow-hidden [&>button]:hidden"
        style={{ boxShadow: "0 20px 60px -15px rgba(245,181,68,0.45)" }}
      >
        <style>{`
@keyframes x1iSlideL{0%{opacity:0;transform:translateX(-26px)}100%{opacity:1;transform:none}}
@keyframes x1iSlideR{0%{opacity:0;transform:translateX(26px)}100%{opacity:1;transform:none}}
@keyframes x1iIn{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:none}}
@keyframes x1iVs{0%{opacity:0;transform:scale(0) rotate(-25deg)}60%{opacity:1;transform:scale(1.25) rotate(8deg)}100%{opacity:1;transform:scale(1) rotate(-5deg)}}
@keyframes x1iVsPulse{0%,100%{transform:scale(1) rotate(-5deg);text-shadow:0 0 16px rgba(245,181,68,.7)}50%{transform:scale(1.12) rotate(-5deg);text-shadow:0 0 30px rgba(245,181,68,1)}}
@keyframes x1iAura{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
@keyframes x1iShine{0%{left:-60%}55%,100%{left:130%}}
.x1i-aura{position:absolute;left:50%;top:-130px;width:320px;height:320px;margin-left:-160px;background:conic-gradient(from 0deg,transparent,rgba(245,181,68,.16),transparent 45%);animation:x1iAura 10s linear infinite;pointer-events:none;filter:blur(3px);}
        `}</style>

        {/* arena com energia + matchup VS */}
        <div className="relative overflow-hidden px-5 pt-6 pb-3" style={{ background: "radial-gradient(120% 80% at 50% 0%, rgba(245,181,68,0.16) 0%, transparent 58%)" }}>
          <div className="x1i-aura" />

          <div className="relative text-center">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[0.3em] text-amber-400 uppercase px-3 py-1 rounded-full border border-amber-500/40 bg-amber-500/10">
              <Swords className="w-3 h-3" /> Desafio · X1
            </span>
          </div>

          <div className="relative mt-5 flex items-start justify-center gap-1">
            <button type="button" onClick={() => otherUid && setProfileUid(otherUid)} className="flex-1 min-w-0 text-center active:scale-95 transition-transform" style={{ animation: "x1iSlideL .5s ease both" }}>
              <div className="mx-auto w-[80px] h-[80px] rounded-full p-[3px]" style={{ background: "linear-gradient(135deg,#F5B544,#e24b4a)", boxShadow: "0 0 26px -4px rgba(245,181,68,.7)" }}>
                {other.avatar ? (
                  <img src={other.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#141418] flex items-center justify-center text-lg font-black text-amber-400">{other.nome.slice(0, 2).toUpperCase()}</div>
                )}
              </div>
              <p className="mt-2 text-sm font-black text-foreground truncate px-0.5">{other.nome}</p>
              <p className="text-[9px] font-bold tracking-[0.2em] text-amber-400/80 uppercase">Ver perfil ›</p>
            </button>

            <div className="shrink-0 pt-5">
              <div className="text-3xl font-black italic text-amber-400" style={{ animation: "x1iVs .6s .15s ease both, x1iVsPulse 1.8s 1s ease-in-out infinite" }}>VS</div>
            </div>

            <button type="button" onClick={() => setProfileUid(userId)} className="flex-1 min-w-0 text-center active:scale-95 transition-transform" style={{ animation: "x1iSlideR .5s ease both" }}>
              <div className="mx-auto w-[80px] h-[80px] rounded-full p-[3px]" style={{ background: "linear-gradient(135deg,#f59e0b,#22c55e)", boxShadow: "0 0 26px -4px rgba(245,158,11,.6)" }}>
                {me?.avatar ? (
                  <img src={me.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#141418] flex items-center justify-center text-lg font-black text-amber-400">{(me?.nome || "VC").slice(0, 2).toUpperCase()}</div>
                )}
              </div>
              <p className="mt-2 text-sm font-black text-foreground truncate px-0.5">{me?.nome || "Você"}</p>
              <p className="text-[9px] font-bold tracking-[0.2em] text-amber-400/80 uppercase">Você</p>
            </button>
          </div>

          <h2 className="relative mt-4 text-center text-lg font-black text-foreground leading-tight px-2" style={{ animation: "x1iIn .5s .2s ease both" }}>
            <span className="text-amber-400">{other.nome}</span> te chamou pra um duelo!
          </h2>
        </div>

        {/* carta de batalha (stats do duelo) */}
        <div className="px-5 pt-1 pb-2">
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-[#0f0f13] p-3 space-y-2" style={{ animation: "x1iIn .5s .3s ease both" }}>
            <span className="pointer-events-none absolute inset-y-0 w-[45%] -skew-x-12" style={{ left: "-60%", background: "linear-gradient(90deg,transparent,rgba(245,215,142,.14),transparent)", animation: "x1iShine 3.6s ease-in-out infinite" }} />
            {challenge.modo && (
              <p className="relative text-center text-sm font-black text-amber-400 break-words">“{challenge.modo}”</p>
            )}
            <div className="relative grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-[#141418] border border-white/5 py-2 px-1 text-center min-w-0">
                <Calendar className="w-3.5 h-3.5 mx-auto text-amber-400/80" />
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground mt-0.5">Dia</p>
                <p className="text-[12px] font-black text-foreground truncate">{dia || "combinar"}</p>
              </div>
              <div className="rounded-xl bg-[#141418] border border-white/5 py-2 px-1 text-center min-w-0">
                <Target className="w-3.5 h-3.5 mx-auto text-amber-400/80" />
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground mt-0.5">Meta</p>
                <p className="text-[12px] font-black text-foreground truncate">{challenge.goal_amount ? fmt(challenge.goal_amount) : "—"}</p>
              </div>
              <div className="rounded-xl bg-[#141418] border border-white/5 py-2 px-1 text-center min-w-0">
                <Coins className="w-3.5 h-3.5 mx-auto text-amber-400/80" />
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground mt-0.5">{stakes > 0 ? "Aposta" : "Tipo"}</p>
                <p className="text-[12px] font-black text-foreground truncate">{stakes > 0 ? fmt(stakes) : "Amistoso"}</p>
              </div>
            </div>
            {stakes > 0 && (
              <p className="relative text-center text-[11px] font-bold text-amber-300">🏆 Vencedor leva o pote — {fmt(stakes * 2)} em jogo</p>
            )}
          </div>
        </div>

        {/* ações */}
        {!showCounter ? (
          <div className="px-6 pt-4 pb-6 space-y-2">
            <button
              onClick={accept}
              className="w-full h-12 rounded-xl bg-amber-500 text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{ boxShadow: "0 8px 24px -8px rgba(245,181,68,0.7)" }}
            >
              <Swords className="w-4 h-4" /> Aceitar o duelo
            </button>
            <button
              onClick={openCounter}
              className="w-full h-11 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-400 font-bold text-sm active:scale-[0.98] transition-transform"
            >
              Fazer contraproposta
            </button>
            <button
              onClick={decline}
              className="w-full h-11 rounded-xl bg-transparent border border-border text-muted-foreground font-bold text-sm active:scale-[0.98] transition-transform"
            >
              Recusar
            </button>
            <button
              onClick={markSeen}
              className="w-full h-8 text-xs text-muted-foreground/70 hover:text-muted-foreground"
            >
              ver depois
            </button>
          </div>
        ) : (
          <div className="px-6 pt-3 pb-6 space-y-2.5">
            <p className="text-xs text-muted-foreground text-center">Proponha os seus termos — {other.nome} decide depois.</p>
            <input
              value={cModo}
              onChange={(e) => setCModo(e.target.value)}
              placeholder="Modo (ex: quem vender mais ganha)"
              className="w-full h-10 rounded-lg bg-[#141418] border border-border/70 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-amber-400/60 outline-none"
            />
            <div className="flex gap-2">
              <label className="flex-1 min-w-0 text-[11px] text-muted-foreground">
                Dia
                <input
                  type="date"
                  value={cDia}
                  onChange={(e) => setCDia(e.target.value)}
                  className="mt-0.5 w-full h-10 rounded-lg bg-[#141418] border border-border/70 px-2 text-sm text-foreground focus:border-amber-400/60 outline-none"
                />
              </label>
              <label className="flex-1 min-w-0 text-[11px] text-muted-foreground">
                Meta R$ (opcional)
                <input
                  inputMode="decimal"
                  value={cMeta}
                  onChange={(e) => setCMeta(e.target.value)}
                  placeholder="0"
                  className="mt-0.5 w-full h-10 rounded-lg bg-[#141418] border border-border/70 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-amber-400/60 outline-none"
                />
              </label>
            </div>
            <label className="block text-[11px] text-muted-foreground">
              Aposta R$ cada (0 = amistoso)
              <input
                inputMode="decimal"
                value={cAposta}
                onChange={(e) => setCAposta(e.target.value)}
                placeholder="0"
                className="mt-0.5 w-full h-10 rounded-lg bg-[#141418] border border-border/70 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-amber-400/60 outline-none"
              />
            </label>
            {cApostaNum > 0 && (
              <div className="space-y-2 rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5">
                <p className="text-[11px] text-amber-400/90">Com aposta, informe sua chave Pix (sem CPF):</p>
                <input
                  value={cPix}
                  onChange={(e) => setCPix(e.target.value)}
                  placeholder="Sua chave Pix"
                  className="w-full h-10 rounded-lg bg-[#141418] border border-border/70 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-amber-400/60 outline-none"
                />
                <input
                  value={cNome}
                  onChange={(e) => setCNome(e.target.value)}
                  placeholder="Nome do titular da chave"
                  className="w-full h-10 rounded-lg bg-[#141418] border border-border/70 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-amber-400/60 outline-none"
                />
              </div>
            )}
            <button
              onClick={sendCounter}
              disabled={sending}
              className="w-full h-12 rounded-xl bg-amber-500 text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
              style={{ boxShadow: "0 8px 24px -8px rgba(245,181,68,0.7)" }}
            >
              <Swords className="w-4 h-4" /> {sending ? "Enviando..." : "Enviar contraproposta"}
            </button>
            <button
              onClick={() => setShowCounter(false)}
              className="w-full h-9 text-xs text-muted-foreground/80 hover:text-muted-foreground"
            >
              Voltar
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <PublicProfileModal open={!!profileUid} onOpenChange={(v) => !v && setProfileUid(null)} userId={profileUid} />
    </>
  );
}
