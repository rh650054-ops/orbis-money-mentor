/* ============================================================
   A SALA (/x1/sala/:id) — placar ao vivo da Sala de Competição.
   • convidado → "fulano te chamou" + ENTRAR (trava a aposta) / Hoje não
   • dentro    → ranking de todos com barra de energia, quem lidera, últimos
                 golpes (vendas do DEFCON), chamar mais gente, link, sair até 12h;
                 CTA DAR UM GOLPE · VENDER
   • de fora   → mesmo placar + ENTRAR pelo link (até lotar, até 18h)
   • fechada   → colocação final e prêmio de cada um
   Atualiza a cada 15 s. A + B unificadas em 02/10/2026 (lib única: x1-sala-lib.ts).
   Sem API externa. Todo hook acima do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Wallet, Flame, Check, X, Loader2, Share2, UserPlus, LogOut, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import "@/components/x1/x1.css";
import { X1Avatar } from "@/components/x1/X1Avatar";
import { fmt, primeiroNome, horaBR, rodadaAgora, horasAteMeiaNoite, patenteCor } from "@/components/x1/x1-lib";
import { type Sala, ordenarPlacar, divisaoPote, carregarSala, carregarGolpesSala, entrarSala, sairSala, aindaEntra, aindaSai, linkSala, SALA_HORA_ENTRADA, SALA_HORA_SAIDA } from "@/components/x1/x1-sala-lib";

const GOLD = "#F5B800";
const RED = "#F2465A";
const OK = "#3DD68C";
interface Golpe { user_id: string; amount: number; created_at: string }

export default function X1Sala() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const uid = user?.id;

  const [s, setS] = useState<Sala | null>(null);
  const [golpes, setGolpes] = useState<Golpe[]>([]);
  const [saldo, setSaldo] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [agindo, setAgindo] = useState(false);
  const [hit, setHit] = useState<string | null>(null);
  const prev = useRef<Record<string, number>>({});

  const carregar = useCallback(async () => {
    if (!id || !uid) return;
    try {
      const [sala, g] = await Promise.all([carregarSala(id), carregarGolpesSala(id)]);
      if (!sala) { setErro("Essa sala não existe mais."); return; }
      // golpe novo → sacode a linha de quem vendeu
      for (const m of sala.lutadores) { const antes = prev.current[m.user_id]; if (antes != null && m.total > antes) setHit(m.user_id); prev.current[m.user_id] = m.total; }
      setS(sala); setGolpes(g);
    } catch (e) { setErro((e as Error).message); }
  }, [id, uid]);
  useEffect(() => { void carregar(); const t = setInterval(carregar, 15000); return () => clearInterval(t); }, [carregar]);
  useEffect(() => {
    if (!uid) return;
    supabase.from("x1_wallets" as any).select("balance").eq("user_id", uid).maybeSingle().then(({ data }) => setSaldo(Number((data as any)?.balance) || 0));
  }, [uid, s?.status, s?.lutadores.length]);
  useEffect(() => { if (!hit) return; try { navigator.vibrate?.(40); } catch (e) { avisar.silencioso("X1Sala: vibração", e); } const t = setTimeout(() => setHit(null), 500); return () => clearTimeout(t); }, [hit]);

  const eu = useMemo(() => s?.lutadores.find((m) => m.user_id === uid) ?? null, [s, uid]);
  const ranking = useMemo(() => (s ? ordenarPlacar(s.lutadores) : []), [s]);
  const convidados = useMemo(() => (s ? s.lutadores.filter((m) => m.status === "convidado") : []), [s]);
  const dentro = ranking.length;
  const divisao = useMemo(() => (s ? divisaoPote(s.stakes_amount, Math.max(dentro, 2)) : null), [s, dentro]);
  const nomeDe = useCallback((userId: string) => (userId === uid ? "Você" : primeiroNome(s?.lutadores.find((m) => m.user_id === userId)?.nome)), [s, uid]);

  const entrar = async () => {
    if (!s || agindo) return;
    setAgindo(true);
    try {
      await entrarSala(s.id);
      try { navigator.vibrate?.([70, 40, 70, 40, 140]); } catch (e) { avisar.silencioso("X1Sala: vibração", e); }
      toast({ title: "Você tá na sala 👊", description: "Cada venda no DEFCON é um golpe. Fecha 23:59." });
      prev.current = {}; await carregar();
    } catch (e) { toast({ title: "Não rolou", description: (e as Error).message, variant: "destructive" }); }
    setAgindo(false);
  };
  const sair = async () => {
    if (!s || agindo) return;
    if (eu?.status === "dentro" && !window.confirm(s.stakes_amount > 0 ? `Sair da sala? Seus ${fmt(s.stakes_amount)} voltam pra carteira.` : "Sair da sala?")) return;
    setAgindo(true);
    try { await sairSala(s.id); toast({ title: eu?.status === "dentro" ? "Você saiu da sala" : "Chamado recusado" }); navigate("/x1"); }
    catch (e) { toast({ title: "Não rolou", description: (e as Error).message, variant: "destructive" }); }
    setAgindo(false);
  };
  const compartilhar = async () => {
    if (!s) return;
    const texto = `Sala "${s.nome}" na Vant: ${dentro} ${dentro === 1 ? "lutador" : "lutadores"}${s.stakes_amount > 0 ? `, ${fmt(s.stakes_amount)} cada` : ", na honra"}. Entra até ${SALA_HORA_ENTRADA}h — quem vende mais hoje leva. ${linkSala(s.id)}`;
    try { if (navigator.share) await navigator.share({ text: texto }); else { await navigator.clipboard.writeText(texto); toast({ title: "Link copiado!" }); } } catch (e) { avisar.silencioso("X1Sala: compartilhar (cancelado)", e); }
  };

  if (!uid) return null;
  if (erro) return <div className="min-h-screen px-6 pt-20 text-center" style={{ background: "#000" }}><p className="text-[15px] font-black">{erro}</p><button type="button" onClick={() => navigate("/x1")} className="x1-btn ouro mt-4">VOLTAR PRA ARENA</button></div>;
  if (!s || !divisao) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#000" }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#8a8378" }} /></div>;

  const aberta = s.status === "open";
  const fechada = s.status === "finished";
  const souDentro = eu?.status === "dentro";
  const souConvidado = eu?.status === "convidado";
  const lotada = dentro >= s.vagas;
  const lider = ranking[0] ?? null;
  const segundo = ranking.find((m) => m.pos === 2) ?? null;
  const minhaPos = ranking.find((m) => m.user_id === uid)?.pos ?? null;
  const maior = Math.max(1, lider?.total ?? 0);
  const quemChamou = eu?.convidado_por ? nomeDe(eu.convidado_por) : "Alguém";
  const rodada = rodadaAgora();
  const golpesDe = (userId: string, fim: string) => { const q = golpes.filter((g) => g.user_id === userId).length; return q > 0 ? `${q} ${q === 1 ? "golpe" : "golpes"} · ${fim}` : fim; };
  const pct = (t: number) => `${Math.max(2, Math.round((t / maior) * 100))}%`;

  const frase = (() => {
    if (fechada) { const v = ranking.filter((m) => m.pos === 1); return v.length > 1 ? `Empate no topo: ${v.map((m) => nomeDe(m.user_id)).join(" e ")} dividem o 1º.` : lider ? `${nomeDe(lider.user_id)} venceu a sala com ${fmt(lider.total)}.` : "Sala fechada."; }
    if (dentro < 2) return `Falta gente: menos de 2 à meia-noite e a sala devolve tudo. Chama alguém.`;
    if (!lider || lider.total === 0) return "Ninguém vendeu ainda. A primeira venda no DEFCON abre o placar.";
    const partes: string[] = [];
    // se eu sou o 2º, a diferença já aparece em "Faltam X pra passar" — não repete o número
    if (segundo && !(souDentro && minhaPos === 2)) partes.push(`${nomeDe(lider.user_id)} lidera por ${fmt(lider.total - segundo.total)}.`); else partes.push(`${nomeDe(lider.user_id)} lidera com ${fmt(lider.total)}.`);
    if (souDentro && minhaPos && minhaPos > 1) { const acima = ranking.find((m) => m.pos === minhaPos - 1); if (acima) partes.push(`Faltam ${fmt(acima.total - (eu?.total ?? 0))} pra passar ${nomeDe(acima.user_id)}.`); }
    else if (souDentro && minhaPos === 1) { const atras = ranking.find((m) => m.pos === 2); if (atras) partes.push(`${nomeDe(atras.user_id)} tá a ${fmt((eu?.total ?? 0) - atras.total)} de você.`); }
    partes.push(`Faltam ${horasAteMeiaNoite()}h.`);
    return partes.join(" ");
  })();

  return (
    <div className="min-h-screen px-4 pt-3 pb-32 max-w-2xl mx-auto relative" style={{ background: aberta ? "radial-gradient(100% 50% at 50% 30%,#1a0508,#000 70%)" : "#000" }}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate("/x1")} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#b3ab9c" }}><ArrowLeft className="w-5 h-5" /></button>
        {aberta ? (
          <span className="flex-1 inline-flex items-center gap-2 text-[10px] font-black tracking-[.14em]" style={{ color: "#ff7d8c" }}><i className="w-[7px] h-[7px] rounded-full x1-live" style={{ background: RED }} /> AO VIVO · RODADA {rodada}/6</span>
        ) : <span className="flex-1 text-[10px] font-black tracking-[.14em]" style={{ color: "#8a8378" }}>{fechada ? "SALA FECHADA" : s.status === "awaiting_result" ? "EM REVISÃO" : "SALA CANCELADA"}</span>}
        {souDentro || souConvidado ? (
          <button type="button" onClick={() => navigate("/x1/carteira")} className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-black" style={{ background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD }}><Wallet className="w-3.5 h-3.5" strokeWidth={2.6} /> {fmt(saldo)}</button>
        ) : (
          <span className="h-8 px-3 rounded-full inline-flex items-center text-[10px] font-black" style={{ background: "#1a1305", border: "1px solid #3a2f0c", color: GOLD }}>{s.stakes_amount > 0 ? `POTE ${fmt(fechada ? s.pote - s.fee_amount : divisao.pote)}` : "NA HONRA"}</span>
        )}
      </div>

      <div className="text-center mt-2">
        <p className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>SALA · {s.nome.toUpperCase()}</p>
        <p className="text-[22px] font-black italic tracking-[.02em] mt-0.5">{dentro} {dentro === 1 ? "LUTADOR" : "LUTADORES"} <span className="x1-vs x1-vs-glow inline-block text-[28px]" style={{ color: GOLD }}>VS</span> O DIA</p>
        <p className="text-[10px] font-black tracking-[.14em] mt-1" style={{ color: "#8a8378" }}>
          {s.stakes_amount > 0 ? `${fmt(s.stakes_amount)} CADA · 1º LEVA ${fmt(divisao.primeiro)}${divisao.segundo > 0 ? ` · 2º ${fmt(divisao.segundo)}` : ""}` : "NA HONRA · VALE XP"} · {aberta ? "FECHA 23:59" : fechada ? "FECHADA" : s.result_notes?.toUpperCase() || ""}
        </p>
      </div>

      {souConvidado && aberta && (
        <div className="rounded-[20px] border p-4 mt-3 x1-slam" style={{ borderColor: `${RED}66`, background: "linear-gradient(160deg,#2a0c11,#0e0e10)" }}>
          <p className="text-[10px] font-black tracking-[.14em]" style={{ color: "#ff7d8c" }}>TE CHAMOU PRA SALA</p>
          <p className="text-[15px] font-black mt-0.5">{quemChamou} quer você nessa briga{s.stakes_amount > 0 ? ` · ${fmt(s.stakes_amount)}` : ""}</p>
          <p className="text-[11.5px] mt-1" style={{ color: "#b3ab9c" }}>{dentro} dentro · {Math.max(0, s.vagas - dentro)} {s.vagas - dentro === 1 ? "vaga" : "vagas"} · entra até {SALA_HORA_ENTRADA}h{s.stakes_amount > 0 ? ` · trava ${fmt(s.stakes_amount)} da carteira` : ""}</p>
          <div className="flex gap-2 mt-3">
            <button type="button" disabled={agindo || lotada || !aindaEntra()} onClick={entrar} className="x1-btn vermelho x1-pulse" style={{ height: 50, fontSize: 14 }}>{agindo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" strokeWidth={3} />} ENTRAR</button>
            <button type="button" disabled={agindo} onClick={sair} aria-label="Recusar" className="w-14 h-[50px] rounded-[16px] inline-flex items-center justify-center shrink-0" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#8a8378" }}><X className="w-5 h-5" strokeWidth={3} /></button>
          </div>
          {lotada && <p className="text-[11px] mt-2" style={{ color: "#ff7d8c" }}>Lotou antes de você entrar.</p>}
          {!lotada && !aindaEntra() && <p className="text-[11px] mt-2" style={{ color: "#ff7d8c" }}>Entrada fechou às {SALA_HORA_ENTRADA}h.</p>}
          {s.stakes_amount > saldo && s.stakes_amount > 0 && <p className="text-[11px] mt-2" style={{ color: "#ff7d8c" }}>Falta saldo pra {fmt(s.stakes_amount)}. Deposita na carteira.</p>}
        </div>
      )}

      {/* RANKING */}
      <div className="mt-3 space-y-2">
        {ranking.map((m, i) => {
          const sou = m.user_id === uid;
          const primeiro = m.pos === 1;
          const premio = fechada ? m.premio : m.pos === 1 ? divisao.primeiro : m.pos === 2 ? divisao.segundo : 0;
          return (
            <div key={m.user_id} className={`grid items-center gap-2.5 rounded-[16px] border px-3 py-2.5 x1-up ${hit === m.user_id ? "x1-hit" : ""}`} style={{ "--i": i, gridTemplateColumns: "28px 44px 1fr auto",
              borderColor: primeiro ? `${GOLD}e6` : sou ? `${GOLD}99` : "#22201a",
              background: primeiro ? "linear-gradient(160deg,#2a1f05,#0e0e10)" : sou ? "linear-gradient(160deg,#1a1305,#0e0e10)" : "#0e0e10",
              boxShadow: primeiro ? `0 0 0 1px ${GOLD}33, 0 14px 30px -18px ${GOLD}b3` : undefined } as React.CSSProperties}>
              <span className="text-[18px] font-black italic" style={{ color: primeiro ? GOLD : m.pos === 2 ? "#cfcfcf" : "#8a8378" }}>{m.pos}º</span>
              <X1Avatar url={m.avatar} nome={m.nome} size={44} cor={primeiro ? OK : sou ? GOLD : m.pos === 2 ? "#cfcfcf" : "#3a3833"} />
              <div className="min-w-0">
                <p className="text-[13.5px] font-black leading-tight truncate">{sou ? "Você" : primeiroNome(m.nome)} <small className="text-[10px] font-black tracking-[.06em]" style={{ color: patenteCor(m.patente) }}>{m.patente}</small></p>
                <p className="text-[10.5px] truncate" style={{ color: "#8a8378" }}>
                  {m.total === 0 ? "sem venda no DEFCON hoje" : primeiro ? golpesDe(m.user_id, fechada ? "venceu" : "lidera") : lider ? `−${fmt(lider.total - m.total)} pro 1º` : ""}
                </p>
                <div className="h-[6px] rounded-[4px] overflow-hidden mt-1.5" style={{ background: "#1a0a0e", border: "1px solid rgba(255,255,255,.08)" }}>
                  <i className="block h-full transition-all duration-700" style={{ width: pct(m.total), background: primeiro ? "linear-gradient(90deg,#1f8f5c,#3DD68C)" : sou ? "linear-gradient(90deg,#B88700,#FFC63A)" : "linear-gradient(90deg,#c8172f,#ff5a6e)", boxShadow: primeiro ? "0 0 10px #3DD68C88" : sou ? "0 0 10px #F5B80088" : "0 0 10px #F2465A88" }} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-[15px] font-black tabular-nums" style={{ color: primeiro ? GOLD : m.total === 0 ? "#8a8378" : "#fff" }}>{fmt(m.total)}</p>
                <p className="text-[9.5px] font-black tracking-[.1em]" style={{ color: "#8a8378" }}>{premio > 0 ? (fechada ? `LEVOU ${fmt(premio)}` : `LEVA ${fmt(premio)}`) : " "}</p>
              </div>
            </div>
          );
        })}
        {ranking.length === 0 && <div className="rounded-[20px] border p-4 text-center" style={{ background: "#0e0e10", borderColor: "#22201a" }}><p className="text-[12.5px]" style={{ color: "#8a8378" }}>Ninguém dentro ainda.</p></div>}
      </div>

      <p className="text-center text-[12px] mt-3" style={{ color: "#e9e4d8" }}>
        <b style={{ color: fechada ? GOLD : "#ff7d8c" }}>{frase.split(". ")[0]}{frase.includes(". ") ? "." : ""}</b>{frase.includes(". ") ? ` ${frase.slice(frase.indexOf(". ") + 2)}` : ""}
      </p>

      {convidados.length > 0 && aberta && (
        <div className="flex items-center gap-2 mt-3 px-1">
          <span className="text-[10px] font-black tracking-[.14em] shrink-0" style={{ color: "#8a8378" }}>CHAMADOS</span>
          <div className="flex -space-x-2">{convidados.slice(0, 6).map((m) => <X1Avatar key={m.user_id} url={m.avatar} nome={m.nome} size={26} cor="#3a3833" />)}</div>
          <span className="text-[10.5px] truncate" style={{ color: "#8a8378" }}>{convidados.map((m) => primeiroNome(m.nome)).join(", ")} ainda não {convidados.length === 1 ? "entrou" : "entraram"}</span>
        </div>
      )}

      {/* GOLPES */}
      <div className="rounded-[20px] border px-3.5 py-3 mt-3 x1-up" style={{ "--i": 5, background: "rgba(11,11,13,.85)", borderColor: "#22201a" } as React.CSSProperties}>
        <p className="text-[10px] font-black tracking-[.16em] mb-1" style={{ color: "#8a8378" }}>ÚLTIMOS GOLPES DA SALA</p>
        {golpes.length === 0 && <p className="text-[11.5px] py-2" style={{ color: "#8a8378" }}>Nenhum golpe ainda. A primeira venda no DEFCON abre o placar.</p>}
        {golpes.slice(0, 6).map((g, i) => { const meu = g.user_id === uid; return (
          <div key={`${g.created_at}-${i}`} className="flex items-center gap-2.5 py-2" style={{ borderTop: "1px solid #22201a" }}>
            <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold tabular-nums ${i === 0 && hit ? "x1-pop" : ""}`} style={meu ? { background: "#1a1305", border: `1px solid ${GOLD}66`, color: GOLD } : { background: "#0d1f16", border: `1px solid ${OK}66`, color: OK }}>+{fmt(g.amount)}</span>
            <p className="text-[12px]" style={{ color: "#e9e4d8" }}>{nomeDe(g.user_id)} · {horaBR(g.created_at)}</p>
          </div>
        ); })}
      </div>

      {/* AÇÕES SECUNDÁRIAS */}
      {aberta && (
        <div className="flex gap-2 mt-3">
          {souDentro && !lotada && aindaEntra() && (
            <button type="button" onClick={() => navigate(`/x1/sala/${s.id}/chamar`)} className="flex-1 h-10 rounded-[12px] inline-flex items-center justify-center gap-1.5 text-[11.5px] font-black" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}><UserPlus className="w-4 h-4" strokeWidth={2.6} /> Chamar mais</button>
          )}
          <button type="button" onClick={compartilhar} className="flex-1 h-10 rounded-[12px] inline-flex items-center justify-center gap-1.5 text-[11.5px] font-black" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}><Share2 className="w-4 h-4" strokeWidth={2.6} /> Link da sala</button>
          {souDentro && aindaSai() && (
            <button type="button" disabled={agindo} onClick={sair} className="h-10 px-3 rounded-[12px] inline-flex items-center justify-center gap-1.5 text-[11.5px] font-black" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#8a8378" }}><LogOut className="w-4 h-4" strokeWidth={2.6} /> Sair</button>
          )}
        </div>
      )}
      {aberta && souDentro && !aindaSai() && <p className="text-[10.5px] text-center mt-2" style={{ color: "#8a8378" }}>Depois do meio-dia ninguém sai da sala. Agora é vender.</p>}
      {aberta && souDentro && aindaSai() && s.stakes_amount > 0 && <p className="text-[10.5px] text-center mt-2" style={{ color: "#8a8378" }}>Dá pra sair até {SALA_HORA_SAIDA}h com a aposta de volta.</p>}

      {fechada && eu && eu.premio > 0 && (
        <div className="rounded-[20px] border p-4 mt-3 text-center x1-slam" style={{ borderColor: `${GOLD}99`, background: "linear-gradient(160deg,#2a1f05,#0e0e10)" }}>
          <Trophy className="w-6 h-6 mx-auto" style={{ color: GOLD }} strokeWidth={2.4} />
          <p className="text-[16px] font-black italic mt-1" style={{ color: GOLD }}>VOCÊ LEVOU {fmt(eu.premio)}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "#b3ab9c" }}>Já tá na carteira.</p>
        </div>
      )}

      <div className="fixed left-0 right-0 z-[40] px-4" style={{ bottom: "calc(env(safe-area-inset-bottom) + 74px)" }}>
        <div className="max-w-2xl mx-auto">
          {!aberta ? (
            <button type="button" onClick={() => navigate("/x1/sala/nova")} className="x1-btn ouro"><UserPlus className="w-5 h-5" strokeWidth={2.6} /> ABRIR OUTRA SALA</button>
          ) : souDentro ? (
            <button type="button" onClick={() => navigate("/defcon")} className="x1-btn vermelho x1-pulse"><Flame className="w-5 h-5" strokeWidth={2.6} /> DAR UM GOLPE · VENDER</button>
          ) : souConvidado ? null : lotada ? (
            <button type="button" disabled className="x1-btn fantasma">SALA CHEIA · {dentro}/{s.vagas}</button>
          ) : !aindaEntra() ? (
            <button type="button" disabled className="x1-btn fantasma">ENTRADA FECHOU ÀS {SALA_HORA_ENTRADA}H</button>
          ) : (
            <button type="button" disabled={agindo} onClick={entrar} className="x1-btn ouro x1-pulse">{agindo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" strokeWidth={3} />} ENTRAR NA SALA{s.stakes_amount > 0 ? ` · TRAVAR ${fmt(s.stakes_amount)}` : ""}</button>
          )}
        </div>
      </div>
    </div>
  );
}
