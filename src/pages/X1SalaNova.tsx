/* ============================================================
   ABRIR SALA (/x1/sala/nova) — X1 em grupo (Rick + Mohamed, 02/10/2026).
   Nome · quantos lutadores (2–8) · valendo (igual pra todos) · pote ao vivo
   com a divisão 1º/2º · grade pra chamar gente (mesma busca do Escolher).
   ABRIR SALA trava a aposta do dono na carteira e manda os convites.
   ?alvo=uid já chega marcado. Todo hook acima do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Wallet, Users, Search, Loader2, Check, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import "@/components/x1/x1.css";
import { X1Avatar } from "@/components/x1/X1Avatar";
import { fmt, primeiroNome, patenteCor, carregarRecorde, type Recorde, RECORDE_VAZIO } from "@/components/x1/x1-lib";
import { SALA_VAGAS, SALA_APOSTAS, SALA_HORA_ENTRADA, divisaoPote, criarSala } from "@/components/x1/x1-sala-lib";

const GOLD = "#F5B800";
const RED = "#F2465A";
const OK = "#3DD68C";

interface Candidato { user_id: string; nome: string; avatar_url: string | null; patente: string; na_arena: boolean; revanche: boolean; posicao: number | null }

export default function X1SalaNova() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const uid = user?.id;

  const [recorde, setRecorde] = useState<Recorde>(RECORDE_VAZIO);
  const [saldo, setSaldo] = useState(0);
  const [nome, setNome] = useState("");
  const [vagas, setVagas] = useState(4);
  const [aposta, setAposta] = useState(0);
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<Candidato[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [marcados, setMarcados] = useState<Record<string, Candidato>>({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!uid) return;
    carregarRecorde(uid).then(setRecorde);
    supabase.from("x1_wallets" as any).select("balance").eq("user_id", uid).maybeSingle().then(({ data }) => setSaldo(Number((data as any)?.balance) || 0));
  }, [uid]);

  const carregarLista = useCallback(async (b: string) => {
    setCarregando(true);
    const { data } = await (supabase as any).rpc("x1_oponentes", { p_filtro: b ? "todos" : "liga", p_busca: b || null });
    setLista(((data as any[]) || []).map((o) => ({ user_id: o.user_id, nome: o.nome, avatar_url: o.avatar_url, patente: o.patente, na_arena: !!o.na_arena, revanche: !!o.revanche, posicao: o.posicao })));
    setCarregando(false);
  }, []);
  useEffect(() => { const t = setTimeout(() => { void carregarLista(busca.trim()); }, busca ? 300 : 0); return () => clearTimeout(t); }, [busca, carregarLista]);

  // ?alvo= chega marcado
  useEffect(() => {
    const alvo = params.get("alvo");
    if (!alvo || alvo === uid || marcados[alvo]) return;
    const daLista = lista.find((o) => o.user_id === alvo);
    if (daLista) setMarcados((m) => ({ ...m, [alvo]: daLista }));
  }, [params, uid, lista, marcados]);

  const escolhidos = useMemo(() => Object.values(marcados), [marcados]);
  const conta = divisaoPote(aposta, vagas);
  const limite = recorde.aposta_max;
  const tarde = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getHours() >= SALA_HORA_ENTRADA;
  const semSaldo = aposta > 0 && saldo < aposta;

  const alternar = (c: Candidato) => setMarcados((m) => {
    const n = { ...m };
    if (n[c.user_id]) delete n[c.user_id];
    else if (Object.keys(n).length < vagas - 1) n[c.user_id] = c;
    else toast({ title: `Sala de ${vagas} já tem ${vagas - 1} chamados`, description: "Aumenta as vagas ou desmarca alguém." });
    return n;
  });

  const abrir = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      const id = await criarSala({ nome: nome.trim() || "Sala de competição", aposta, vagas, convidados: escolhidos.map((c) => c.user_id) });
      try { navigator.vibrate?.([60, 40, 90]); } catch { /* sem vibração */ }
      toast({ title: "Sala aberta", description: escolhidos.length ? `${escolhidos.length} chamados. Manda o link pra mais gente.` : "Manda o link pra galera entrar." });
      navigate(`/x1/sala/${id}`, { replace: true });
    } catch (e) {
      toast({ title: "Não rolou", description: (e as Error).message, variant: "destructive" });
    } finally { setEnviando(false); }
  };

  if (!uid) return null;

  return (
    <div className="min-h-screen pb-44 px-4 pt-3 max-w-2xl mx-auto space-y-3" style={{ background: "#000" }}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate("/x1")} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#b3ab9c" }}><ArrowLeft className="w-5 h-5" /></button>
        <p className="flex-1 text-[11px] font-black tracking-[.2em]" style={{ color: "#8a8378" }}>NOVA SALA · HOJE</p>
        <button type="button" onClick={() => navigate("/x1/carteira")} className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-black" style={{ background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD }}><Wallet className="w-3.5 h-3.5" strokeWidth={2.6} /> {fmt(saldo)}</button>
      </div>

      <div className="rounded-[20px] border p-3.5 x1-up" style={{ background: "#0e0e10", borderColor: "#22201a" }}>
        <label htmlFor="sala-nome" className="text-[10px] font-black tracking-[.16em]" style={{ color: "#8a8378" }}>NOME DA SALA</label>
        <input id="sala-nome" value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} placeholder="ex: Sexta do caos" className="w-full h-11 mt-1.5 px-3 rounded-[13px] text-[14px] text-white outline-none" style={{ background: "#16151a", border: "1px solid #2a2823" }} />
      </div>

      <div className="rounded-[20px] border p-3.5 x1-up" style={{ "--i": 1, background: "#0e0e10", borderColor: "#22201a" } as React.CSSProperties}>
        <p className="text-[10px] font-black tracking-[.16em]" style={{ color: "#8a8378" }}>QUANTOS LUTADORES</p>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {SALA_VAGAS.map((v) => (
            <button key={v} type="button" onClick={() => { setVagas(v); setMarcados((m) => Object.fromEntries(Object.entries(m).slice(0, v - 1))); }} className="w-10 h-9 rounded-full text-[12px] font-black" style={vagas === v ? { background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD } : { background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>{v}</button>
          ))}
        </div>
        <p className="text-[10px] font-black tracking-[.16em] mt-3" style={{ color: "#8a8378" }}>VALENDO (IGUAL PRA TODOS)</p>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {SALA_APOSTAS.map((v) => { const trava = v > limite; return (
            <button key={v} type="button" disabled={trava} onClick={() => setAposta(v)} className="h-9 px-3 rounded-full text-[11px] font-black disabled:opacity-40" style={aposta === v ? { background: v === 0 ? "#1a1305" : "#2a0c11", border: `1px solid ${v === 0 ? GOLD : RED}`, color: v === 0 ? GOLD : "#ff7d8c" } : { background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
              {v === 0 ? "Honra" : `R$ ${v}`}{trava ? " 🔒" : ""}
            </button>
          ); })}
        </div>
        {limite <= 0 && <p className="text-[10.5px] mt-1.5" style={{ color: "#8a8378" }}>Aposta em dinheiro libera em BRIGÃO (50 XP). Honra vale igual.</p>}

        {aposta > 0 ? (
          <>
            <div className="flex items-end justify-between mt-3">
              <div>
                <p className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>POTE COM {vagas} · 10% DA CASA</p>
                <p className="text-[26px] font-black italic tabular-nums leading-none mt-1" style={{ color: GOLD }}>{fmt(conta.pote)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black tracking-[.16em]" style={{ color: "#8a8378" }}>VOCÊ TRAVA AGORA</p>
                <p className="text-[15px] font-black tabular-nums">{fmt(aposta)}</p>
              </div>
            </div>
            <div className="flex gap-1.5 mt-2 text-[11px] font-black">
              <span className="h-8 rounded-[9px] flex items-center justify-center" style={{ flex: vagas <= 2 ? 9 : 7, background: "#2a1f05", border: `1px solid ${GOLD}88`, color: GOLD }}>1º leva {fmt(conta.primeiro)}</span>
              {conta.segundo > 0 && <span className="h-8 rounded-[9px] flex items-center justify-center" style={{ flex: 3, background: "#1c1c1f", border: "1px solid #333", color: "#cfcfcf" }}>2º {fmt(conta.segundo)}</span>}
              <span className="h-8 rounded-[9px] flex items-center justify-center" style={{ flex: 1.2, background: "#1a0a0e", border: `1px solid ${RED}66`, color: "#ff7d8c" }}>10%</span>
            </div>
            <p className="text-[10.5px] mt-1.5" style={{ color: "#8a8378" }}>Valores com a sala cheia. Se entrar menos gente, o pote encolhe junto.</p>
          </>
        ) : (
          <p className="text-[11px] mt-3" style={{ color: "#b3ab9c" }}>Sala na honra: ninguém aposta, vale XP e o pódio.</p>
        )}
      </div>

      <div className="rounded-[20px] border p-3.5 x1-up" style={{ "--i": 2, background: "#0e0e10", borderColor: "#22201a" } as React.CSSProperties}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black tracking-[.16em]" style={{ color: "#8a8378" }}>CHAMAR PRA SALA</p>
          <span className="text-[10px] font-black tracking-[.14em]" style={{ color: GOLD }}>{escolhidos.length}/{vagas - 1} ESCOLHIDOS</span>
        </div>
        <div className="relative mt-2">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#8a8378" }} />
          <input id="sala-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar vendedor…" className="w-full h-11 pl-10 pr-3 rounded-[13px] text-[13.5px] text-white outline-none" style={{ background: "#16151a", border: "1px solid #2a2823" }} />
        </div>
        {carregando ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8a8378" }} /></div>
        ) : (
          <div className="grid grid-cols-4 gap-2 mt-3">
            {[...escolhidos.filter((e) => !lista.some((l) => l.user_id === e.user_id)), ...lista].map((c) => {
              const on = !!marcados[c.user_id];
              const selo = c.na_arena ? { t: "● NA ARENA", cor: OK } : c.revanche ? { t: "REVANCHE", cor: GOLD } : { t: c.patente, cor: patenteCor(c.patente) };
              return (
                <button key={c.user_id} type="button" onClick={() => alternar(c)} className="flex flex-col items-center gap-1 min-w-0 relative">
                  <X1Avatar url={c.avatar_url} nome={c.nome} size={44} cor={on ? GOLD : "#3a3833"} style={on ? { boxShadow: `0 0 0 3px ${GOLD}44, 0 0 18px ${GOLD}66` } : undefined} />
                  {on && <span className="absolute top-0 right-2 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: GOLD }}><Check className="w-3 h-3" strokeWidth={4} color="#1a1305" /></span>}
                  <b className="text-[11px] truncate max-w-full" style={{ color: on ? GOLD : "#fff" }}>{primeiroNome(c.nome)}</b>
                  <span className="text-[8.5px] font-black tracking-[.06em] truncate max-w-full" style={{ color: selo.cor }}>{selo.t}</span>
                </button>
              );
            })}
          </div>
        )}
        {!carregando && lista.length === 0 && <p className="text-[11.5px] text-center py-2" style={{ color: "#8a8378" }}>{busca ? "Nenhum vendedor com esse nome." : "Busca pelo nome pra chamar qualquer vendedor da Vant."}</p>}
        <p className="text-[10.5px] mt-3 leading-snug flex gap-1.5" style={{ color: "#8a8378" }}><Link2 className="w-3.5 h-3.5 shrink-0 mt-px" /> Depois de abrir você pega o link. Qualquer vendedor entra por ele até lotar. Entrada até 18h, saída com devolução até 12h. Menos de 2 à meia-noite: cancela e devolve.</p>
      </div>

      <div className="fixed left-0 right-0 z-[40] px-4" style={{ bottom: "calc(env(safe-area-inset-bottom) + 74px)" }}>
        <div className="max-w-2xl mx-auto">
          {semSaldo && <p className="text-[11px] text-center mb-1.5" style={{ color: "#ff7d8c" }}>Falta saldo pra {fmt(aposta)}. Deposita na carteira ou abre na honra.</p>}
          {tarde && <p className="text-[11px] text-center mb-1.5" style={{ color: "#ff7d8c" }}>Depois das 18h não abre sala. Amanhã cedo você abre.</p>}
          <button type="button" onClick={abrir} disabled={enviando || tarde || semSaldo} className="x1-btn ouro">
            {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" strokeWidth={2.6} />} ABRIR SALA{aposta > 0 ? ` · TRAVAR ${fmt(aposta)}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
