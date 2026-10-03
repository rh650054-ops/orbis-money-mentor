/* ============================================================
   ABRIR SALA (/x1/sala/nova) — Sala de Competição, X1 em grupo.
   Nome · quantos lutadores (2–8) · valendo (honra ou aposta igual pra todos,
   travada pela patente) · pote em tempo real (−10% da casa, 1º/2º) ·
   chamar vendedores (grade, busca) · ABRIR SALA. A aposta é travada na hora,
   igual ao X1. ?alvo=uid pré-seleciona um convidado.
   Mesma tela em modo CHAMAR MAIS (/x1/sala/:id/chamar): só a grade de
   vendedores (quem já tá na sala some) + link da sala → x1_sala_convidar.
   A + B unificadas em 02/10/2026 (lib única: x1-sala-lib.ts).
   Sem API externa. Todo hook acima do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Users, Search, Loader2, Lock, Link2, UserPlus, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import "@/components/x1/x1.css";
import { useTravaBanco } from "@/components/x1/x1-trava-lib";
import { X1Avatar } from "@/components/x1/X1Avatar";
import { fmt, primeiroNome, carregarRecorde, type Recorde, RECORDE_VAZIO } from "@/components/x1/x1-lib";
import { SALA_VAGAS, SALA_APOSTAS, SALA_HORA_ENTRADA, aindaEntra, divisaoPote, criarSala, carregarSala, convidarSala, linkSala, type Sala } from "@/components/x1/x1-sala-lib";

const GOLD = "#F5B800";
const RED = "#F2465A";
const OK = "#3DD68C";

interface Candidato { user_id: string; nome: string; avatar_url: string | null; patente: string; posicao: number | null; na_arena: boolean; revanche: boolean; vitorias: number; derrotas: number }

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="rounded-[20px] border p-3.5" style={{ background: "#0e0e10", borderColor: "#22201a", ...style }}>{children}</div>;
}
function Chip({ on, cor = "ouro", disabled, onClick, children }: { on: boolean; cor?: "ouro" | "vermelho"; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  const c = cor === "ouro" ? GOLD : RED;
  const txt = cor === "ouro" ? GOLD : "#ff7d8c";
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="h-8 px-3 rounded-full text-[11px] font-black inline-flex items-center gap-1 disabled:opacity-40"
      style={on ? { background: cor === "ouro" ? "#1a1305" : "#2a0c11", border: `1px solid ${c}`, color: txt } : { background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
      {children}
    </button>
  );
}

export default function X1SalaNova() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { id: salaId } = useParams<{ id?: string }>();   // presente só em /x1/sala/:id/chamar
  const uid = user?.id;
  // TRAVA (03/10): sem banco ligado não entra aqui; volta pra Arena, que explica.
  const { semBanco } = useTravaBanco(uid);
  useEffect(() => { if (semBanco) navigate("/x1", { replace: true }); }, [semBanco, navigate]);

  const [nome, setNome] = useState("");
  const [vagas, setVagas] = useState(4);
  const [aposta, setAposta] = useState(0);
  const [recorde, setRecorde] = useState<Recorde>(RECORDE_VAZIO);
  const [saldo, setSaldo] = useState(0);
  const [verificado, setVerificado] = useState(false);
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<Candidato[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [escolhidos, setEscolhidos] = useState<Candidato[]>([]);
  const [abrindo, setAbrindo] = useState(false);
  const [sala, setSala] = useState<Sala | null>(null);

  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    Promise.all([
      carregarRecorde(uid),
      supabase.from("x1_wallets" as any).select("balance").eq("user_id", uid).maybeSingle(),
      supabase.from("profiles").select("verificado").eq("user_id", uid).maybeSingle(),
    ]).then(([r, w, p]) => {
      if (!vivo) return;
      setRecorde(r); setSaldo(Number((w.data as any)?.balance) || 0); setVerificado(!!(p.data as any)?.verificado);
    });
    return () => { vivo = false; };
  }, [uid]);

  // modo CHAMAR MAIS: carrega a sala pra saber vagas, quem já tá dentro e o nome
  useEffect(() => {
    if (!uid || !salaId) return;
    let vivo = true;
    carregarSala(salaId).then((s) => {
      if (!vivo) return;
      if (!s) { toast({ title: "Essa sala não existe mais", variant: "destructive" }); navigate("/x1", { replace: true }); return; }
      setSala(s); setNome(s.nome); setVagas(s.vagas); setAposta(s.stakes_amount);
    }).catch((e) => { if (vivo) { toast({ title: "Não rolou", description: (e as Error).message, variant: "destructive" }); navigate(`/x1/sala/${salaId}`, { replace: true }); } });
    return () => { vivo = false; };
  }, [uid, salaId, navigate]);

  const carregarLista = useCallback(async (b: string) => {
    setCarregando(true);
    const { data } = await (supabase as any).rpc("x1_oponentes", { p_filtro: "todos", p_busca: b || null });
    setLista(((data as any[]) || []).map((o) => ({ ...o, vitorias: Number(o.vitorias) || 0, derrotas: Number(o.derrotas) || 0 })) as Candidato[]);
    setCarregando(false);
  }, []);
  useEffect(() => { const t = setTimeout(() => { void carregarLista(busca.trim()); }, busca ? 300 : 0); return () => clearTimeout(t); }, [busca, carregarLista]);

  // ?alvo=uid (vem do ranking / relatório) já entra como escolhido
  useEffect(() => {
    const alvo = params.get("alvo");
    if (!alvo || alvo === uid || escolhidos.some((c) => c.user_id === alvo)) return;
    const c = lista.find((o) => o.user_id === alvo);
    if (c) setEscolhidos((prev) => (prev.some((x) => x.user_id === alvo) ? prev : [...prev, c]));
  }, [params, uid, lista, escolhidos]);

  const chamando = !!salaId;
  const limite = recorde.aposta_max;
  const divisao = useMemo(() => divisaoPote(aposta, vagas), [aposta, vagas]);
  // quem já tá dentro ou já foi chamado não aparece na grade do modo CHAMAR MAIS
  const jaNaSala = useMemo(() => new Set((sala?.lutadores ?? []).filter((m) => m.status === "dentro" || m.status === "convidado").map((m) => m.user_id)), [sala]);
  const dentro = useMemo(() => (sala?.lutadores ?? []).filter((m) => m.status === "dentro").length, [sala]);
  const maxConvites = chamando ? Math.max(0, vagas - dentro) : vagas - 1;
  const candidatos = useMemo(() => (chamando ? lista.filter((c) => !jaNaSala.has(c.user_id)) : lista), [chamando, lista, jaNaSala]);
  const abertoAgora = aindaEntra();
  const faltaSaldo = aposta > 0 && saldo < aposta;

  const alternar = (c: Candidato) => {
    setEscolhidos((prev) => {
      if (prev.some((x) => x.user_id === c.user_id)) return prev.filter((x) => x.user_id !== c.user_id);
      if (prev.length >= maxConvites) { toast({ title: chamando ? (maxConvites === 0 ? "Sala cheia" : `Só ${maxConvites === 1 ? "sobra 1 vaga" : `sobram ${maxConvites} vagas`} na sala`) : `Sala de ${vagas}: dá pra chamar ${maxConvites}`, description: chamando ? "Quem entrar primeiro fica com a vaga." : "Aumenta o tamanho da sala pra chamar mais gente." }); return prev; }
      return [...prev, c];
    });
  };

  const copiarLink = async () => {
    if (!salaId) return;
    const texto = `Entra na sala "${nome}" na Vant — quem vende mais hoje leva. ${linkSala(salaId)}`;
    try { if (navigator.share) await navigator.share({ text: texto }); else { await navigator.clipboard.writeText(texto); toast({ title: "Link copiado!" }); } } catch (e) { avisar.silencioso("X1SalaNova: compartilhar (cancelado)", e); }
  };

  const abrir = async () => {
    if (abrindo) return;
    setAbrindo(true);
    try {
      if (chamando && salaId) {
        const n = await convidarSala(salaId, escolhidos.map((c) => c.user_id));
        toast({ title: n > 0 ? `${n} ${n === 1 ? "pessoa chamada" : "pessoas chamadas"} 👊` : "Ninguém novo chamado", description: "Quem não entrar pelo chamado ainda entra pelo link, até lotar." });
        navigate(`/x1/sala/${salaId}`, { replace: true });
      } else {
        const id = await criarSala({ nome: nome.trim() || "Sala de competição", aposta, vagas, convidados: escolhidos.map((c) => c.user_id) });
        try { navigator.vibrate?.([60, 40, 90]); } catch { /* sem vibração */ }
        toast({ title: "Sala aberta 👊", description: escolhidos.length > 0 ? `${escolhidos.length} ${escolhidos.length === 1 ? "pessoa recebeu" : "pessoas receberam"} o chamado. Manda o link pra quem faltou.` : "Manda o link pra galera entrar." });
        navigate(`/x1/sala/${id}`, { replace: true });
      }
    } catch (e) {
      toast({ title: "Não rolou", description: (e as Error).message, variant: "destructive" });
    }
    setAbrindo(false);
  };

  if (!uid) return null;
  if (chamando && !sala) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#000" }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#8a8378" }} /></div>;

  return (
    <div className="min-h-screen pb-36 px-4 pt-3 max-w-2xl mx-auto space-y-3" style={{ background: "#000" }}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate(chamando ? `/x1/sala/${salaId}` : "/x1")} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#b3ab9c" }}><ArrowLeft className="w-5 h-5" /></button>
        <p className="flex-1 text-[11px] font-black tracking-[.2em]" style={{ color: "#8a8378" }}>{chamando ? "CHAMAR MAIS · HOJE" : "NOVA SALA · HOJE"}</p>
        <button type="button" onClick={() => navigate("/x1/carteira")} className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-black" style={{ background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD }}><Wallet className="w-3.5 h-3.5" strokeWidth={2.6} /> {fmt(saldo)}</button>
      </div>

      {!abertoAgora && (
        <Card style={{ borderColor: `${RED}66`, background: "linear-gradient(160deg,#2a0c11,#0e0e10)" }}>
          <p className="text-[13px] font-black" style={{ color: "#ff7d8c" }}>{chamando ? `Entrada na sala fechou às ${SALA_HORA_ENTRADA}h` : `Sala só abre até ${SALA_HORA_ENTRADA}h`}</p>
          <p className="text-[11.5px] mt-0.5" style={{ color: "#b3ab9c" }}>{chamando ? "Quem for chamado agora não consegue mais entrar hoje." : "Depois disso o dia já tá na metade e não dá pra todo mundo brigar igual. Amanhã cedo você abre outra."}</p>
        </Card>
      )}

      {chamando && sala ? (
        <Card style={{ borderColor: `${GOLD}73`, background: "linear-gradient(160deg,#1a1305,#0e0e10)" }}>
          <p className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>SALA · {sala.nome.toUpperCase()}</p>
          <p className="text-[15px] font-black mt-0.5">{dentro} dentro · {Math.max(0, sala.vagas - dentro)} {sala.vagas - dentro === 1 ? "vaga" : "vagas"}{sala.stakes_amount > 0 ? ` · ${fmt(sala.stakes_amount)} cada` : " · na honra"}</p>
          <p className="text-[11px] mt-1" style={{ color: "#b3ab9c" }}>Quem você chamar recebe o aviso na Arena. Quem não for chamado entra pelo link até lotar.</p>
        </Card>
      ) : (
      <Card>
        <label htmlFor="sala-nome" className="text-[10px] font-black tracking-[.16em]" style={{ color: "#8a8378" }}>NOME DA SALA</label>
        <input id="sala-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} placeholder="Ex: Sexta do caos" className="w-full h-11 mt-1.5 px-3 rounded-[13px] text-[14px] text-white outline-none" style={{ background: "#16151a", border: "1px solid #2a2823" }} />
      </Card>
      )}

      {!chamando && (
      <Card>
        <p className="text-[10px] font-black tracking-[.16em]" style={{ color: "#8a8378" }}>QUANTOS LUTADORES</p>
        <div className="flex gap-1.5 flex-wrap mt-2">
          {SALA_VAGAS.map((v) => <Chip key={v} on={vagas === v} onClick={() => { setVagas(v); setEscolhidos((p) => p.slice(0, v - 1)); }}>{v}</Chip>)}
        </div>
        <p className="text-[10px] font-black tracking-[.16em] mt-3" style={{ color: "#8a8378" }}>VALENDO (IGUAL PRA TODOS)</p>
        <div className="flex gap-1.5 flex-wrap mt-2">
          {SALA_APOSTAS.map((v) => { const trava = v > limite; return (
            <Chip key={v} on={aposta === v} cor={v === 0 ? "ouro" : "vermelho"} disabled={trava} onClick={() => setAposta(v)}>
              {v === 0 ? "Honra" : `R$ ${v}`}{trava && <Lock className="w-3 h-3" />}
            </Chip>
          ); })}
        </div>
        {limite <= 0 ? (
          <p className="text-[10.5px] mt-2" style={{ color: "#8a8378" }}>Aposta em dinheiro libera em BRIGÃO (50 XP). Na honra vale XP igual.</p>
        ) : aposta > 0 && !verificado ? (
          <p className="text-[10.5px] mt-2" style={{ color: "#ff7d8c" }}>Pra apostar dinheiro você precisa conectar onde recebe (Vender → verificado).</p>
        ) : aposta > 0 && faltaSaldo ? (
          <p className="text-[10.5px] mt-2" style={{ color: "#ff7d8c" }}>Falta saldo: você tem {fmt(saldo)} e a aposta é {fmt(aposta)}. Deposita na carteira ou abre na honra.</p>
        ) : null}

        <div className="flex items-center justify-between gap-3 mt-3">
          <div>
            <p className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>{aposta > 0 ? `POTE COM ${vagas} · 10% DA CASA` : "NA HONRA"}</p>
            <p className="text-[26px] font-black italic leading-none mt-1 tabular-nums" style={{ color: GOLD }}>{aposta > 0 ? fmt(divisao.pote) : "XP"}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black tracking-[.16em]" style={{ color: "#8a8378" }}>VOCÊ TRAVA AGORA</p>
            <p className="text-[15px] font-black mt-1 tabular-nums">{aposta > 0 ? fmt(aposta) : "R$ 0"}</p>
          </div>
        </div>
        {aposta > 0 && (
          <div className="flex gap-1.5 mt-2">
            <span className="h-[30px] rounded-[9px] flex items-center justify-center text-[11px] font-black" style={{ flex: 7, background: "#2a1f05", border: `1px solid ${GOLD}80`, color: GOLD }}>1º leva {fmt(divisao.primeiro)}</span>
            {divisao.segundo > 0 && <span className="h-[30px] rounded-[9px] flex items-center justify-center text-[11px] font-black" style={{ flex: 3, background: "#1c1c1f", border: "1px solid #333", color: "#cfcfcf" }}>2º {fmt(divisao.segundo)}</span>}
            <span className="h-[30px] rounded-[9px] flex items-center justify-center text-[11px] font-black" style={{ flex: 1.2, background: "#1a0a0e", border: `1px solid ${RED}66`, color: "#ff7d8c" }}>10%</span>
          </div>
        )}
        <p className="text-[10.5px] mt-2 leading-snug" style={{ color: "#8a8378" }}>{vagas <= 2 ? "Com 2 lutadores, quem vende mais leva tudo." : "Com 3 ou mais: 1º leva 70%, 2º leva 30%. Empate divide."} O pote final é com quem ficar na sala.</p>
      </Card>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black tracking-[.16em]" style={{ color: "#8a8378" }}>CHAMAR PRA SALA</p>
          <span className="text-[10px] font-black tracking-[.14em]" style={{ color: GOLD }}>{escolhidos.length} DE {maxConvites}</span>
        </div>
        <div className="relative mt-2">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#8a8378" }} />
          <input id="sala-busca" aria-label="Buscar vendedor" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar vendedor…" className="w-full h-11 pl-10 pr-3 rounded-[13px] text-[13.5px] text-white outline-none" style={{ background: "#16151a", border: "1px solid #2a2823" }} />
        </div>
        {escolhidos.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-2.5">
            {escolhidos.map((c) => (
              <button key={c.user_id} type="button" onClick={() => alternar(c)} className="h-8 pl-1 pr-2.5 rounded-full inline-flex items-center gap-1.5 text-[11px] font-black" style={{ background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD }}>
                <X1Avatar url={c.avatar_url} nome={c.nome} size={24} cor={GOLD} /> {primeiroNome(c.nome)} ×
              </button>
            ))}
          </div>
        )}
        {carregando ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8a8378" }} /></div>
        ) : candidatos.length === 0 && !chamando ? (
          <p className="text-[12px] py-4 text-center" style={{ color: "#8a8378" }}>{busca ? "Nenhum vendedor com esse nome." : "Ninguém pra chamar ainda."}</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 mt-3">
            {candidatos.slice(0, 16).map((c) => {
              const on = escolhidos.some((x) => x.user_id === c.user_id);
              const selo = c.na_arena ? "● NA ARENA" : c.revanche ? "REVANCHE" : c.posicao ? `#${c.posicao}` : c.patente;
              const seloCor = c.na_arena ? OK : c.revanche ? GOLD : "#8a8378";
              return (
                <button key={c.user_id} type="button" onClick={() => alternar(c)} className="flex flex-col items-center gap-1 text-center active:scale-95 transition-transform">
                  <X1Avatar url={c.avatar_url} nome={c.nome} size={44} cor={on ? GOLD : "#3a3833"} style={on ? { boxShadow: `0 0 0 3px ${GOLD}44` } : undefined} />
                  <b className="block text-[11px] text-white max-w-[72px] truncate">{primeiroNome(c.nome)}</b>
                  <small className="block text-[8.5px] font-extrabold tracking-[.08em] truncate max-w-[72px]" style={{ color: seloCor }}>{selo}</small>
                </button>
              );
            })}
            {chamando && (
              <button type="button" onClick={copiarLink} className="flex flex-col items-center gap-1 text-center active:scale-95 transition-transform">
                <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ border: "2px dashed #3a3833", color: "#8a8378" }}><Link2 className="w-5 h-5" strokeWidth={2.4} /></span>
                <b className="block text-[11px] text-white">link</b>
                <small className="block text-[8.5px] font-extrabold tracking-[.08em]" style={{ color: "#8a8378" }}>COPIAR</small>
              </button>
            )}
          </div>
        )}
        <p className="text-[10.5px] mt-3 leading-snug" style={{ color: "#8a8378" }}>
          {chamando ? `Quem não for chamado também entra pelo link até lotar. Entrada até ${SALA_HORA_ENTRADA}h, saída até 12h.` : `Quem não for chamado também entra pelo link até lotar (o link aparece depois que a sala abre). Entrada até ${SALA_HORA_ENTRADA}h, saída até 12h. Sala com menos de 2 à meia-noite devolve tudo.`}
        </p>
      </Card>

      <div className="fixed left-0 right-0 z-[40] px-4" style={{ bottom: "calc(env(safe-area-inset-bottom) + 74px)" }}>
        <div className="max-w-2xl mx-auto">
          {chamando ? (
            <button type="button" onClick={abrir} disabled={abrindo || !abertoAgora || escolhidos.length === 0} className="x1-btn ouro">
              {abrindo ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" strokeWidth={2.6} />}
              {escolhidos.length === 0 ? "ESCOLHE QUEM CHAMAR" : `CHAMAR ${escolhidos.length} PRA SALA`}
            </button>
          ) : (
            <button type="button" onClick={abrir} disabled={abrindo || !abertoAgora || (aposta > 0 && (faltaSaldo || !verificado))} className="x1-btn ouro">
              {abrindo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" strokeWidth={2.6} />}
              {aposta > 0 ? `ABRIR SALA · TRAVAR ${fmt(aposta)}` : "ABRIR SALA · NA HONRA"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
