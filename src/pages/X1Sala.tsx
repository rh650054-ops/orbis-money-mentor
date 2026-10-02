/* ============================================================
   A SALA (/x1/sala/:id) — X1 em grupo (Rick + Mohamed, 02/10/2026).
   • convidado / de fora → card "ENTRAR · TRAVAR R$ X" (ou recusar)
   • dentro, aberta      → placar ao vivo (posição, barra, quanto leva),
                           frase de pressão, golpes da sala, chamar mais
                           gente / link, sair até 12h; CTA VENDER
   • fechada             → pódio com prêmios
   Atualiza a cada 15 s. Sem API externa. Todo hook acima do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Flame, Loader2, Share2, UserPlus, X, Check, Trophy, Search, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import "@/components/x1/x1.css";
import { X1Avatar } from "@/components/x1/X1Avatar";
import { fmt, primeiroNome, horaBR, rodadaAgora, horasAteMeiaNoite, patenteCor } from "@/components/x1/x1-lib";
import { carregarSala, carregarGolpesSala, entrarSala, sairSala, convidarSala, divisaoPote, ordenarPlacar, linkSala, SALA_HORA_SAIDA, SALA_HORA_ENTRADA, type Sala } from "@/components/x1/x1-sala-lib";

const GOLD = "#F5B800";
const RED = "#F2465A";
const OK = "#3DD68C";
const horaBRAgora = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getHours();

interface Cand { user_id: string; nome: string; avatar_url: string | null; patente: string }

export default function X1Sala() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const uid = user?.id;

  const [s, setS] = useState<Sala | null>(null);
  const [golpes, setGolpes] = useState<{ user_id: string; amount: number; created_at: string }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [agindo, setAgindo] = useState(false);
  const [convidando, setConvidando] = useState(false);
  const [busca, setBusca] = useState("");
  const [cands, setCands] = useState<Cand[]>([]);
  const [marcados, setMarcados] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    if (!id || !uid) return;
    const [sala, g] = await Promise.all([carregarSala(id), carregarGolpesSala(id)]);
    if (!sala) { setErro("Essa sala não existe mais."); return; }
    setS(sala); setGolpes(g);
  }, [id, uid]);
  useEffect(() => { void carregar(); const t = setInterval(carregar, 15000); return () => clearInterval(t); }, [carregar]);

  useEffect(() => {
    if (!convidando) return;
    const t = setTimeout(async () => {
      const b = busca.trim();
      const { data } = await (supabase as any).rpc("x1_oponentes", { p_filtro: b ? "todos" : "liga", p_busca: b || null });
      setCands(((data as any[]) || []).map((o) => ({ user_id: o.user_id, nome: o.nome, avatar_url: o.avatar_url, patente: o.patente })));
    }, busca ? 300 : 0);
    return () => clearTimeout(t);
  }, [convidando, busca]);

  const placar = useMemo(() => (s ? ordenarPlacar(s.lutadores) : []), [s]);
  const eu = s?.lutadores.find((l) => l.user_id === uid) || null;
  const naSala = new Set((s?.lutadores || []).filter((l) => l.status === "dentro" || l.status === "convidado").map((l) => l.user_id));

  const acao = async (fn: () => Promise<unknown>, ok: string) => {
    setAgindo(true);
    try { await fn(); toast({ title: ok }); await carregar(); }
    catch (e) { toast({ title: "Não rolou", description: (e as Error).message, variant: "destructive" }); }
    finally { setAgindo(false); }
  };
  const compartilhar = async () => {
    if (!s) return;
    const texto = `Sala "${s.nome}" na Arena X1 da Vant: ${s.stakes_amount > 0 ? `R$ ${s.stakes_amount} cada` : "na honra"}, quem vender mais hoje leva. Entra aqui: ${linkSala(s.id)}`;
    try { if (navigator.share) await navigator.share({ text: texto }); else { await navigator.clipboard.writeText(texto); toast({ title: "Link copiado" }); } } catch { /* cancelado */ }
  };

  if (!uid) return null;
  if (erro) return <div className="min-h-screen px-6 pt-20 text-center" style={{ background: "#000" }}><p className="text-[15px] font-black">{erro}</p><button type="button" onClick={() => navigate("/x1")} className="x1-btn ouro mt-4">VOLTAR PRA ARENA</button></div>;
  if (!s) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#000" }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#8a8378" }} /></div>;

  const aberta = s.status === "open";
  const fechada = s.status === "finished";
  const dentro = eu?.status === "dentro";
  const n = placar.length;
  const conta = divisaoPote(s.stakes_amount, n);
  const lider = placar[0];
  const meuIdx = placar.findIndex((p) => p.user_id === uid);
  const acima = meuIdx > 0 ? placar[meuIdx - 1] : null;
  const abaixo = meuIdx >= 0 && meuIdx < n - 1 ? placar[meuIdx + 1] : null;
  const maior = Math.max(1, ...placar.map((p) => p.total));
  const levaDe = (pos: number) => (fechada ? null : s.stakes_amount <= 0 ? null : pos === 1 ? conta.primeiro : pos === 2 && conta.segundo > 0 ? conta.segundo : null);
  const cheia = n >= s.vagas;
  const podeEntrar = aberta && !dentro && !cheia && horaBRAgora() < SALA_HORA_ENTRADA;
  const podeSair = aberta && dentro && horaBRAgora() < SALA_HORA_SAIDA;

  let frase = "";
  if (aberta && n > 0) {
    if (dentro && meuIdx === 0 && placar[1]) frase = `Você lidera por ${fmt(lider!.total - placar[1].total)}. ${primeiroNome(placar[1].nome)} tá na sua cola.`;
    else if (dentro && acima) frase = `${primeiroNome(acima.nome)} tá ${fmt(acima.total - (placar[meuIdx]?.total || 0))} na sua frente.${abaixo ? ` ${primeiroNome(abaixo.nome)} tá a ${fmt((placar[meuIdx]?.total || 0) - abaixo.total)} de você.` : ""}`;
    else if (lider && lider.total > 0) frase = `${primeiroNome(lider.nome)} lidera com ${fmt(lider.total)}.`;
    else frase = "Ninguém vendeu ainda. A primeira venda no DEFCON abre o placar.";
  }

  return (
    <div className="min-h-screen px-4 pt-3 pb-36 max-w-2xl mx-auto space-y-3" style={{ background: "radial-gradient(100% 50% at 50% 30%,#1a0508,#000 70%)" }}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate("/x1")} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#b3ab9c" }}><ArrowLeft className="w-5 h-5" /></button>
        {aberta ? (
          <span className="flex-1 inline-flex items-center gap-2 text-[10px] font-black tracking-[.14em]" style={{ color: "#ff7d8c" }}><i className="w-[7px] h-[7px] rounded-full x1-live" style={{ background: RED }} /> AO VIVO · RODADA {rodadaAgora()}/6</span>
        ) : <span className="flex-1 text-[10px] font-black tracking-[.14em]" style={{ color: "#8a8378" }}>{fechada ? "SALA FECHADA" : "SALA CANCELADA"}</span>}
        <span className="h-8 px-3 rounded-full inline-flex items-center text-[11px] font-black" style={{ background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD }}>{s.stakes_amount > 0 ? `POTE ${fmt(fechada ? s.pote - s.fee_amount : conta.pote)}` : "NA HONRA"}</span>
      </div>

      <div className="text-center x1-up">
        <p className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>SALA · {s.nome.toUpperCase()}</p>
        <p className="text-[22px] font-black italic tracking-tight mt-0.5">{n} {n === 1 ? "LUTADOR" : "LUTADORES"} <span className="x1-vs x1-vs-glow" style={{ color: GOLD }}>VS</span> O DIA</p>
        <p className="text-[10px] font-black tracking-[.14em] mt-1" style={{ color: "#8a8378" }}>
          {s.stakes_amount > 0 ? `${fmt(s.stakes_amount)} CADA · 1º LEVA ${fmt(conta.primeiro)}${conta.segundo > 0 ? ` · 2º ${fmt(conta.segundo)}` : ""}` : "VALE XP E O PÓDIO"} · {n}/{s.vagas} VAGAS{aberta ? ` · FECHA 23:59` : ""}
        </p>
      </div>

      {/* convite / entrar */}
      {aberta && !dentro && (
        <div className="rounded-[20px] border p-3.5 x1-slam" style={{ borderColor: `${RED}66`, background: "linear-gradient(160deg,#2a0c11,#0e0e10)" }}>
          <p className="text-[10px] font-black tracking-[.14em]" style={{ color: "#ff7d8c" }}>{eu?.status === "convidado" ? "TE CHAMARAM PRA ESSA SALA" : "SALA ABERTA"}</p>
          <p className="text-[14px] font-black mt-0.5">{cheia ? "Sala cheia." : s.stakes_amount > 0 ? `Entra com ${fmt(s.stakes_amount)} e briga por até ${fmt(divisaoPote(s.stakes_amount, n + 1).primeiro)}.` : "Entra na honra: vale XP e o pódio."}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "#8a8378" }}>Quem vender mais no DEFCON até 23:59 vence. Entrada até 18h · sair com devolução só até 12h.</p>
          <div className="flex gap-2 mt-3">
            <button type="button" disabled={!podeEntrar || agindo} onClick={() => acao(() => entrarSala(s.id), "Você tá na sala")} className="x1-btn ouro flex-1" style={{ height: 50 }}>
              {agindo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" strokeWidth={3} />} {cheia ? "LOTADA" : s.stakes_amount > 0 ? `ENTRAR · TRAVAR ${fmt(s.stakes_amount)}` : "ENTRAR"}
            </button>
            {eu?.status === "convidado" && <button type="button" disabled={agindo} onClick={() => acao(() => sairSala(s.id), "Convite recusado")} aria-label="Recusar" className="w-12 rounded-[16px] inline-flex items-center justify-center" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#8a8378" }}><X className="w-5 h-5" strokeWidth={3} /></button>}
          </div>
        </div>
      )}

      {/* placar */}
      <div className="space-y-2">
        {placar.map((p, i) => {
          const sou = p.user_id === uid;
          const primeiro = p.pos === 1 && p.total > 0;
          const leva = fechada ? (p.premio > 0 ? p.premio : null) : levaDe(p.pos);
          const corBarra = primeiro ? "linear-gradient(90deg,#1f8f5c,#3DD68C)" : sou ? "linear-gradient(90deg,#B88700,#FFC63A)" : "linear-gradient(90deg,#c8172f,#ff5a6e)";
          const sub = fechada ? `${p.patente}` : sou && acima && i > 0 ? `−${fmt(acima.total - p.total)} pro ${acima.pos}º` : !sou && meuIdx >= 0 && i === meuIdx + 1 && placar[meuIdx] ? `${fmt(placar[meuIdx]!.total - p.total)} atrás de você` : p.total === 0 ? "sem venda hoje" : p.patente;
          return (
            <div key={p.user_id} className="grid items-center gap-2.5 rounded-[16px] border px-3 py-2.5 x1-up" style={{ "--i": i, gridTemplateColumns: "28px 44px 1fr auto", background: primeiro ? "linear-gradient(160deg,#2a1f05,#0e0e10)" : sou ? "linear-gradient(160deg,#1a1305,#0e0e10)" : "#0e0e10", borderColor: primeiro ? `${GOLD}e6` : sou ? `${GOLD}99` : "#22201a", boxShadow: primeiro ? `0 14px 30px -18px ${GOLD}b3` : undefined } as React.CSSProperties}>
              <span className="text-[18px] font-black italic" style={{ color: p.pos === 1 ? GOLD : p.pos === 2 ? "#cfcfcf" : "#8a8378" }}>{p.pos}º</span>
              <X1Avatar url={p.avatar} nome={p.nome} size={40} cor={sou ? GOLD : primeiro ? OK : patenteCor(p.patente)} />
              <div className="min-w-0">
                <p className="text-[13.5px] font-black truncate leading-tight">{sou ? "Você" : primeiroNome(p.nome)}</p>
                <p className="text-[10.5px] font-extrabold truncate" style={{ color: "#8a8378" }}>{sub}</p>
                <div className="h-[6px] rounded-[4px] overflow-hidden mt-1.5" style={{ background: "#1a0a0e", border: "1px solid rgba(255,255,255,.08)" }}><i className="block h-full transition-all duration-700" style={{ width: `${Math.round((p.total / maior) * 100)}%`, background: corBarra }} /></div>
              </div>
              <div className="text-right">
                <p className="text-[15px] font-black tabular-nums" style={{ color: primeiro ? GOLD : p.total === 0 ? "#8a8378" : "#fff" }}>{fmt(p.total)}</p>
                {leva != null ? <p className="text-[9.5px] font-black tracking-[.1em]" style={{ color: fechada ? OK : "#8a8378" }}>{fechada ? "GANHOU" : "LEVA"} {fmt(leva)}</p> : <p className="text-[9.5px]">&nbsp;</p>}
              </div>
            </div>
          );
        })}
        {aberta && Array.from({ length: Math.max(0, s.vagas - n) }).slice(0, 3).map((_, i) => (
          <div key={`v${i}`} className="flex items-center gap-2.5 rounded-[16px] border border-dashed px-3 py-2.5" style={{ borderColor: "#2a2823" }}>
            <span className="w-10 h-10 rounded-full border-2 border-dashed" style={{ borderColor: "#2a2823" }} />
            <p className="text-[12px] font-bold" style={{ color: "#5c574d" }}>Vaga aberta{s.lutadores.some((l) => l.status === "convidado") && i === 0 ? ` · ${s.lutadores.filter((l) => l.status === "convidado").map((l) => primeiroNome(l.nome)).slice(0, 2).join(", ")} chamado` : ""}</p>
          </div>
        ))}
      </div>

      {frase && <p className="text-[12px] text-center" style={{ color: "#e9e4d8" }}><b style={{ color: dentro && meuIdx === 0 ? OK : "#ff7d8c" }}>{frase}</b>{dentro ? ` Faltam ${horasAteMeiaNoite()}h.` : ""}</p>}
      {fechada && <p className="text-[12px] text-center" style={{ color: "#b3ab9c" }}><Trophy className="w-4 h-4 inline -mt-0.5 mr-1" style={{ color: GOLD }} />{lider ? `${primeiroNome(lider.nome)} venceu a sala.` : "Sala fechada."} Prêmios já caíram na carteira.</p>}
      {s.status === "cancelled" && <p className="text-[12px] text-center" style={{ color: "#b3ab9c" }}>{s.result_notes || "Sala cancelada"}. Quem apostou recebeu de volta.</p>}

      {golpes.length > 0 && (
        <div className="rounded-[20px] border px-3.5 py-3" style={{ background: "rgba(11,11,13,.85)", borderColor: "#22201a" }}>
          <p className="text-[10px] font-black tracking-[.16em] mb-1" style={{ color: "#8a8378" }}>ÚLTIMOS GOLPES DA SALA</p>
          {golpes.slice(0, 6).map((g, i) => { const quem = s.lutadores.find((l) => l.user_id === g.user_id); const meu = g.user_id === uid; return (
            <div key={`${g.created_at}-${i}`} className="flex items-center gap-2.5 py-2" style={{ borderTop: "1px solid #22201a" }}>
              <span className="rounded-full px-2.5 py-1 text-[10.5px] font-extrabold tabular-nums" style={meu ? { background: "#0d1f16", border: `1px solid ${OK}66`, color: OK } : { background: "#2a0c11", border: `1px solid ${RED}66`, color: "#ff7d8c" }}>+{fmt(g.amount)}</span>
              <p className="text-[12px]" style={{ color: "#e9e4d8" }}>{meu ? "Você" : primeiroNome(quem?.nome)} · {horaBR(g.created_at)}</p>
            </div>
          ); })}
        </div>
      )}

      {aberta && dentro && (
        <div className="flex gap-2">
          <button type="button" onClick={() => { setConvidando(true); setMarcados([]); setBusca(""); }} disabled={cheia} className="x1-btn fantasma flex-1 disabled:opacity-40"><UserPlus className="w-4 h-4" /> Chamar mais</button>
          <button type="button" onClick={compartilhar} className="x1-btn fantasma flex-1"><Share2 className="w-4 h-4" /> Link da sala</button>
          {podeSair && <button type="button" disabled={agindo} onClick={() => acao(() => sairSala(s.id), s.stakes_amount > 0 ? `Saiu · ${fmt(s.stakes_amount)} de volta` : "Você saiu da sala")} aria-label="Sair da sala" className="x1-btn fantasma" style={{ width: 52 }}><LogOut className="w-4 h-4" /></button>}
        </div>
      )}
      {aberta && dentro && !podeSair && <p className="text-[10.5px] text-center" style={{ color: "#8a8378" }}>Depois do meio-dia a sala trava: ninguém sai, é vender.</p>}

      <div className="fixed left-0 right-0 z-[40] px-4" style={{ bottom: "calc(env(safe-area-inset-bottom) + 74px)" }}>
        <div className="max-w-2xl mx-auto">
          {aberta && dentro ? (
            <button type="button" onClick={() => navigate("/defcon")} className="x1-btn vermelho x1-pulse"><Flame className="w-5 h-5" strokeWidth={2.6} /> DAR UM GOLPE · VENDER</button>
          ) : !aberta ? (
            <button type="button" onClick={() => navigate("/x1/sala/nova")} className="x1-btn ouro">ABRIR OUTRA SALA</button>
          ) : null}
        </div>
      </div>

      {convidando && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center" style={{ background: "rgba(0,0,0,.75)" }} onClick={(e) => { if (e.target === e.currentTarget) setConvidando(false); }}>
          <div className="w-full max-w-2xl rounded-t-[24px] p-4 space-y-3 x1-up" style={{ background: "linear-gradient(180deg,#141216,#0b0b0d)", border: `1px solid ${GOLD}55`, borderBottom: 0, paddingBottom: "calc(20px + env(safe-area-inset-bottom))", maxHeight: "85dvh", overflow: "auto" }}>
            <div className="flex items-center justify-between"><p className="text-[16px] font-black italic">CHAMAR PRA SALA</p><button type="button" onClick={() => setConvidando(false)} aria-label="Fechar" style={{ color: "#8a8378" }}><X className="w-5 h-5" /></button></div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#8a8378" }} />
              <input id="sala-convite-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do vendedor…" className="w-full h-11 pl-10 pr-3 rounded-[13px] text-[13.5px] text-white outline-none" style={{ background: "#16151a", border: "1px solid #2a2823" }} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {cands.filter((c) => !naSala.has(c.user_id) && c.user_id !== uid).map((c) => { const on = marcados.includes(c.user_id); return (
                <button key={c.user_id} type="button" onClick={() => setMarcados((m) => (on ? m.filter((x) => x !== c.user_id) : [...m, c.user_id]))} className="flex flex-col items-center gap-1 min-w-0">
                  <X1Avatar url={c.avatar_url} nome={c.nome} size={44} cor={on ? GOLD : "#3a3833"} />
                  <b className="text-[11px] truncate max-w-full" style={{ color: on ? GOLD : "#fff" }}>{primeiroNome(c.nome)}</b>
                </button>
              ); })}
            </div>
            <button type="button" disabled={marcados.length === 0 || agindo} onClick={async () => { await acao(() => convidarSala(s.id, marcados), `${marcados.length} chamado${marcados.length > 1 ? "s" : ""}`); setConvidando(false); }} className="x1-btn ouro">
              <UserPlus className="w-5 h-5" /> CHAMAR {marcados.length || ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
