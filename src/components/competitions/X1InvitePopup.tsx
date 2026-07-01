import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/shared/hooks/use-toast";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { Swords } from "lucide-react";
import { getBrazilDate } from "@/shared/lib/date-utils";

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
  const [open, setOpen] = useState(false);

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
      // Já vi este convite nesta sessão? Não reabre.
      if (sessionStorage.getItem(`x1invite_seen_${mine.id}`)) return;

      // O proponente (quem mandou a bola) é o "outro": last_proposed_by, ou o outro participante.
      const otherId =
        mine.last_proposed_by && mine.last_proposed_by !== userId
          ? mine.last_proposed_by
          : mine.challenger_id === userId
            ? mine.opponent_id
            : mine.challenger_id;
      const { data: prof } = await supabase
        .from("public_profiles")
        .select("nickname, avatar_url")
        .eq("user_id", otherId)
        .maybeSingle();
      if (!alive) return;
      const p = prof as any;
      setOther({ nome: p?.nickname || "Um vendedor", avatar: p?.avatar_url ?? null });
      setChallenge(mine);
      setOpen(true);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!challenge || !other) return null;

  const markSeen = () => {
    sessionStorage.setItem(`x1invite_seen_${challenge.id}`, "1");
    setOpen(false);
  };

  const accept = () => {
    markSeen();
    navigate("/x1");
  };

  const decline = async () => {
    await (supabase as any).rpc("x1_negotiate", {
      p_id: challenge.id,
      p_action: "decline",
      p_pix: null,
      p_nome: null,
      p_modo: null,
      p_goal: null,
      p_stakes: null,
      p_date: null,
    });
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
    <Dialog open={open} onOpenChange={(v) => !v && markSeen()}>
      <DialogContent
        className="max-w-sm border-amber-500/40 bg-[#0c0c0f] p-0 overflow-hidden [&>button]:hidden"
        style={{ boxShadow: "0 20px 60px -15px rgba(245,181,68,0.45)" }}
      >
        {/* brilho dourado no topo */}
        <div className="relative px-6 pt-8 pb-5 text-center bg-gradient-to-b from-amber-500/15 to-transparent">
          <div className="mx-auto mb-4 flex items-center justify-center animate-in zoom-in-50 duration-500">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center border-2 border-amber-400"
              style={{ background: "rgba(245,181,68,0.12)", boxShadow: "0 0 32px -4px rgba(245,181,68,0.6)" }}
            >
              <Swords className="w-9 h-9 text-amber-400" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {other.avatar ? (
              <img
                src={other.avatar}
                alt=""
                className="w-12 h-12 rounded-full object-cover border-2 border-amber-400/60"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-foreground border-2 border-amber-400/60">
                {other.nome.slice(0, 2).toUpperCase()}
              </div>
            )}
            <h2 className="text-xl font-black text-foreground leading-tight px-2">
              {other.nome} te chamou pra um X1!
            </h2>
          </div>
        </div>

        {/* termos do desafio */}
        <div className="px-6 pb-2 animate-in fade-in duration-700">
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 space-y-1.5 text-center">
            {challenge.modo && (
              <p className="text-sm font-bold text-amber-400">{challenge.modo}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {dia ? `dia ${dia}` : "dia a combinar"}
              {challenge.goal_amount ? ` · meta ${fmt(challenge.goal_amount)}` : ""}
              {stakes > 0 ? ` · aposta ${fmt(stakes)} cada` : " · amistoso"}
            </p>
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
              <Swords className="w-4 h-4" /> Aceitar
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
              <label className="flex-1 text-[11px] text-muted-foreground">
                Dia
                <input
                  type="date"
                  value={cDia}
                  onChange={(e) => setCDia(e.target.value)}
                  className="mt-0.5 w-full h-10 rounded-lg bg-[#141418] border border-border/70 px-2 text-sm text-foreground focus:border-amber-400/60 outline-none"
                />
              </label>
              <label className="flex-1 text-[11px] text-muted-foreground">
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
  );
}
