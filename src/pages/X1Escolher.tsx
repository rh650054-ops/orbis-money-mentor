/* ============================================================
   ESCOLHER OPONENTE — grade de cards de lutador (não é lista).
   Filtros: Na sua liga · Acima de você · Revanche · Todos (+ busca por nome).
   Toca num card → "tale of the tape" (você × ele) + valendo (Honra / R$ →
   volta) → LUTAR HOJE. Amistoso com oponente "na arena" começa na hora;
   senão ele recebe o desafio e precisa aceitar.
   ?alvo=uid pré-seleciona (vem do ranking, relatório, alertas).
   Todo hook acima do primeiro return. Sem API externa.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Wallet, Swords, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import "@/components/x1/x1.css";
import { X1Avatar } from "@/components/x1/X1Avatar";
import { FighterCardMini } from "@/components/x1/FighterCard";
import { fmt, primeiroNome, patenteCor, carregarRecorde, carregarPessoas, erroBonito, voltaPraVoce, type Pessoa, type Recorde, RECORDE_VAZIO } from "@/components/x1/x1-lib";

const GOLD = "#F5B800";
const RED = "#F2465A";
const OK = "#3DD68C";
const APOSTAS = [0, 10, 20, 50];

interface Oponente { user_id: string; nome: string; avatar_url: string | null; patente: string; vitorias: number; derrotas: number; posicao: number | null; diferenca: number; potencia: number; na_arena: boolean; vitorias_contra: number; derrotas_contra: number; revanche: boolean; o_que_vende: string | null }
type Filtro = "liga" | "acima" | "revanche" | "todos";
const FILTROS: { k: Filtro; t: string }[] = [{ k: "liga", t: "Na sua liga" }, { k: "acima", t: "Acima de você" }, { k: "revanche", t: "Revanche" }, { k: "todos", t: "Todos" }];

function VsSplash({ eu, ele }: { eu: Pessoa; ele: Pessoa }) {
  return (
    <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center" style={{ background: "radial-gradient(100% 60% at 50% 50%,#1a0508,#000 75%)" }}>
      <div className="flex items-center gap-5">
        <div className="x1-slam"><X1Avatar url={eu.avatar_url} nome={eu.nome} size={110} cor={GOLD} style={{ borderWidth: 4, boxShadow: `0 0 0 8px ${GOLD}22, 0 0 60px ${GOLD}77` }} /></div>
        <span className="x1-vs x1-vs-glow text-[56px] font-black italic" style={{ color: GOLD, animationDelay: ".25s" }}>VS</span>
        <div className="x1-slam" style={{ animationDelay: ".12s" }}><X1Avatar url={ele.avatar_url} nome={ele.nome} size={110} cor={RED} style={{ borderWidth: 4, boxShadow: `0 0 0 8px ${RED}22, 0 0 60px ${RED}77` }} /></div>
      </div>
      <p className="x1-up text-[22px] font-black mt-8 tracking-tight" style={{ "--i": 8 } as React.CSSProperties}>{primeiroNome(eu.nome)} × {primeiroNome(ele.nome)}</p>
      <p className="x1-up text-[12px] mt-1" style={{ "--i": 10, color: "#b3ab9c" } as React.CSSProperties}>Quem vende mais até 23:59 leva. Vai!</p>
    </div>
  );
}

export default function X1Escolher() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const uid = user?.id;

  const [eu, setEu] = useState<Pessoa | null>(null);
  const [recorde, setRecorde] = useState<Recorde>(RECORDE_VAZIO);
  const [saldo, setSaldo] = useState(0);
  const [filtro, setFiltro] = useState<Filtro>("liga");
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<Oponente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sel, setSel] = useState<Oponente | null>(null);
  const [aposta, setAposta] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [splash, setSplash] = useState<{ ele: Pessoa; id: string } | null>(null);

  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    Promise.all([carregarRecorde(uid), carregarPessoas([uid]), supabase.from("x1_wallets" as any).select("balance").eq("user_id", uid).maybeSingle()]).then(([r, m, w]) => {
      if (!vivo) return;
      setRecorde(r); setEu(m[uid] || { user_id: uid, nome: "Você", avatar_url: null }); setSaldo(Number((w.data as any)?.balance) || 0);
    });
    return () => { vivo = false; };
  }, [uid]);

  const carregarLista = useCallback(async (f: Filtro, b: string) => {
    setCarregando(true);
    const { data } = await (supabase as any).rpc("x1_oponentes", { p_filtro: b ? "todos" : f, p_busca: b || null });
    setLista(((data as any[]) || []).map((o) => ({ ...o, diferenca: Number(o.diferenca) || 0, potencia: Number(o.potencia) || 0, vitorias: Number(o.vitorias) || 0, derrotas: Number(o.derrotas) || 0 })) as Oponente[]);
    setCarregando(false);
  }, []);
  useEffect(() => { const t = setTimeout(() => { void carregarLista(filtro, busca.trim()); }, busca ? 300 : 0); return () => clearTimeout(t); }, [filtro, busca, carregarLista]);

  // pré-seleção por ?alvo=
  useEffect(() => {
    const alvo = params.get("alvo");
    if (!alvo || !uid || alvo === uid) return;
    const daLista = lista.find((o) => o.user_id === alvo);
    if (daLista) { setSel(daLista); return; }
    if (sel?.user_id === alvo) return;
    let vivo = true;
    Promise.all([carregarPessoas([alvo]), carregarRecorde(alvo)]).then(([m, r]) => {
      if (!vivo) return;
      const p = m[alvo] || { user_id: alvo, nome: "Vendedor", avatar_url: null };
      setSel({ user_id: alvo, nome: p.nome, avatar_url: p.avatar_url, patente: r.patente, vitorias: r.vitorias, derrotas: r.derrotas, posicao: null, diferenca: 0, potencia: r.potencia, na_arena: false, vitorias_contra: 0, derrotas_contra: 0, revanche: false, o_que_vende: null });
    });
    return () => { vivo = false; };
  }, [params, uid, lista, sel?.user_id]);

  const limite = recorde.aposta_max;
  const eu_ = useMemo(() => eu || { user_id: uid || "", nome: "Você", avatar_url: null }, [eu, uid]);

  const lutar = async () => {
    if (!sel || enviando) return;
    setEnviando(true);
    const { data, error } = await (supabase as any).rpc("x1_lutar", { p_opponent: sel.user_id, p_stakes: aposta });
    setEnviando(false);
    if (error) { toast({ title: "Não rolou", description: erroBonito(error.message), variant: "destructive" }); return; }
    const r = data as { id: string; status: string; ja_existia: boolean };
    const ele: Pessoa = { user_id: sel.user_id, nome: sel.nome, avatar_url: sel.avatar_url };
    if (r.status === "active") {
      try { navigator.vibrate?.([70, 40, 70, 40, 140]); } catch { /* sem vibração */ }
      setSplash({ ele, id: r.id });
      setTimeout(() => navigate(`/x1/luta/${r.id}`, { replace: true }), 1900);
    } else {
      toast({ title: r.ja_existia ? "Vocês já têm um duelo hoje" : `${primeiroNome(sel.nome)} recebeu seu desafio`, description: r.ja_existia ? "Abrindo ele." : "Assim que ele aceitar, a luta começa. Você vê aqui." });
      navigate(`/x1/luta/${r.id}`, { replace: true });
    }
  };

  if (!uid) return null;

  return (
    <div className="min-h-screen pb-40 px-4 pt-3 max-w-2xl mx-auto space-y-3" style={{ background: "#000" }}>
      {splash && <VsSplash eu={eu_} ele={splash.ele} />}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate("/x1")} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#b3ab9c" }}><ArrowLeft className="w-5 h-5" /></button>
        <p className="flex-1 text-[11px] font-black tracking-[.2em]" style={{ color: "#8a8378" }}>ESCOLHA SEU OPONENTE</p>
        <button type="button" onClick={() => navigate("/x1/carteira")} className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-black" style={{ background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD }}><Wallet className="w-3.5 h-3.5" strokeWidth={2.6} /> {fmt(saldo)}</button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#8a8378" }} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do vendedor…" className="w-full h-11 pl-10 pr-3 rounded-[13px] text-[13.5px] text-white outline-none" style={{ background: "#16151a", border: "1px solid #2a2823" }} />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        {FILTROS.map((f) => (
          <button key={f.k} type="button" onClick={() => { setFiltro(f.k); setBusca(""); }} className="shrink-0 h-8 px-3 rounded-full text-[11px] font-black whitespace-nowrap" style={filtro === f.k && !busca ? { background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD } : { background: "#16151a", border: "1px solid #2a2823", color: "#b3ab9c" }}>{f.t}</button>
        ))}
      </div>

      {carregando ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8a8378" }} /></div>
      ) : lista.length === 0 ? (
        <div className="rounded-[20px] border p-5 text-center" style={{ background: "#0e0e10", borderColor: "#22201a" }}>
          <p className="text-[13px] font-black">{filtro === "revanche" ? "Ninguém te venceu nos últimos 7 dias" : filtro === "acima" ? "Ninguém acima de você no ranking" : busca ? "Nenhum vendedor com esse nome" : "Ninguém na sua liga ainda"}</p>
          <p className="text-[11.5px] mt-1" style={{ color: "#8a8378" }}>Tenta "Todos" — qualquer vendedor do Orbis pode ser desafiado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          {lista.map((o, i) => {
            const selo = o.na_arena ? "● NA ARENA" : o.revanche ? "REVANCHE" : o.posicao && o.diferenca > 0 ? `#${o.posicao} · ACIMA` : o.vitorias + o.derrotas === 0 ? "1ª LUTA" : null;
            const seloCor = o.na_arena ? OK : o.revanche ? GOLD : o.diferenca > 0 ? "#ff7d8c" : "#8a8378";
            const linha = o.posicao ? (o.diferenca > 0 ? `${fmt(o.diferenca)} na frente` : o.diferenca < 0 ? `${fmt(-o.diferenca)} atrás` : `#${o.posicao}`) : (o.o_que_vende || "");
            return (
              <FighterCardMini key={o.user_id} nome={o.nome} avatar={o.avatar_url} patente={o.patente} vitorias={o.vitorias} derrotas={o.derrotas} linha={linha} selo={selo} seloCor={seloCor} potencia={o.potencia} selecionado={sel?.user_id === o.user_id} onClick={() => setSel(o)} style={{ animation: "x1-up .4s ease-out both", animationDelay: `${Math.min(i, 10) * 50}ms` }} />
            );
          })}
        </div>
      )}

      {/* TALE OF THE TAPE + LUTAR (fixo embaixo quando tem seleção) */}
      {sel && (
        <div className="fixed left-0 right-0 z-[40] px-4" style={{ bottom: "calc(env(safe-area-inset-bottom) + 70px)" }}>
          <div className="max-w-2xl mx-auto rounded-[22px] p-3.5 x1-slam" key={sel.user_id} style={{ background: "linear-gradient(180deg,#141216,#0b0b0d)", border: `1px solid ${GOLD}66`, boxShadow: "0 -20px 50px #000" }}>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <X1Avatar url={eu_.avatar_url} nome={eu_.nome} size={40} cor={GOLD} />
                <div className="min-w-0"><p className="text-[12px] font-black truncate" style={{ color: GOLD }}>VOCÊ</p><p className="text-[10.5px]" style={{ color: "#8a8378" }}>{recorde.patente} · {recorde.vitorias}V</p></div>
              </div>
              <span className="x1-vs x1-vs-glow text-[22px] font-black italic" style={{ color: GOLD }}>VS</span>
              <div className="flex-1 flex items-center gap-2 justify-end text-right min-w-0">
                <div className="min-w-0"><p className="text-[12px] font-black truncate" style={{ color: "#ff7d8c" }}>{primeiroNome(sel.nome).toUpperCase()}</p><p className="text-[10.5px]" style={{ color: patenteCor(sel.patente) }}>{sel.patente} · {sel.vitorias}V</p></div>
                <X1Avatar url={sel.avatar_url} nome={sel.nome} size={40} cor={RED} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 text-[11.5px] font-black tabular-nums">
              <span style={{ color: OK }}>{recorde.potencia > 0 ? fmt(recorde.potencia) : "—"}</span><span className="text-[9px] tracking-[.14em]" style={{ color: "#8a8378" }}>POTÊNCIA / DIA</span><span>{sel.potencia > 0 ? fmt(sel.potencia) : "—"}</span>
            </div>
            <div className="flex items-center justify-between mt-1 text-[11.5px] font-black tabular-nums">
              <span style={{ color: OK }}>{sel.vitorias_contra}</span><span className="text-[9px] tracking-[.14em]" style={{ color: "#8a8378" }}>ENTRE VOCÊS</span><span>{sel.derrotas_contra}</span>
            </div>
            <div className="flex gap-1.5 mt-2.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {APOSTAS.map((v) => { const trava = v > limite; return (
                <button key={v} type="button" disabled={trava} onClick={() => setAposta(v)} className="shrink-0 h-8 px-2.5 rounded-full text-[10.5px] font-extrabold whitespace-nowrap disabled:opacity-40" style={aposta === v ? { background: v === 0 ? "#1a1305" : "#2a0c11", border: `1px solid ${v === 0 ? GOLD : RED}`, color: v === 0 ? GOLD : "#ff7d8c" } : { background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
                  {v === 0 ? "Honra" : <>R$ {v} → <b style={{ color: OK }}>volta {voltaPraVoce(v)}</b></>}
                </button>
              ); })}
            </div>
            {limite <= 0 && <p className="text-[10.5px] mt-1.5" style={{ color: "#8a8378" }}>Aposta em dinheiro libera em BRIGÃO (50 XP). Honra vale XP igual.</p>}
            <button type="button" onClick={lutar} disabled={enviando} className="x1-btn vermelho mt-2.5">
              {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Swords className="w-5 h-5" strokeWidth={2.6} />} LUTAR HOJE
            </button>
            <p className="text-[10.5px] text-center mt-1.5" style={{ color: "#8a8378" }}>{sel.na_arena && aposta === 0 ? `${primeiroNome(sel.nome)} tá na arena · começa na hora` : `${primeiroNome(sel.nome)} recebe agora com sua foto · começa quando aceitar`}</p>
          </div>
        </div>
      )}
    </div>
  );
}
