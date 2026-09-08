/* ============================================================
   CARD DA ARENA X1 NO DASHBOARD — mesma linguagem do "jogo de luta"
   (foto com anel, VS dourado, barra de energia, botão com peso).
   Mostra UMA coisa por vez:
     1) luta rolando hoje  → placar ao vivo + DAR UM GOLPE
     2) alguém te desafiou → LUTAR (abre a luta)
     3) sem luta           → rival na sua altura + LUTAR COM ELE
     4) nunca lutou        → convite pra primeira luta (amistoso)
   Fotos reais. Só Supabase, sem API externa.
   ============================================================ */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Swords, Flame, Check, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import "@/components/x1/x1.css";
import { X1Avatar } from "@/components/x1/X1Avatar";
import { carregarPessoas, carregarRecorde, fmt, primeiroNome, patenteCor, proximaPatente, voltaPraVoce, xpPct, type Pessoa, type Recorde, RECORDE_VAZIO } from "@/components/x1/x1-lib";

const GOLD = "#F5B800";
const RED = "#F2465A";
const OK = "#3DD68C";
const HOT = "#ff7a1a";

type Estado =
  | { tipo: "luta"; id: string; ele: Pessoa; meu: number; dele: number; stakes: number }
  | { tipo: "desafio"; id: string; ele: Pessoa; stakes: number; quando: string }
  | { tipo: "rival"; ele: Pessoa; posicao: number | null; diferenca: number; vivas: number }
  | { tipo: "primeira"; vivas: number };

export function X1HomeBanner({ userId }: { userId: string | undefined }) {
  const navigate = useNavigate();
  const [eu, setEu] = useState<Pessoa | null>(null);
  const [r, setR] = useState<Recorde>(RECORDE_VAZIO);
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    (async () => {
      const hoje = getBrazilDate();
      const [{ data: rows }, rec, meMap, lv] = await Promise.all([
        supabase.from("x1_challenges" as any)
          .select("id, challenger_id, opponent_id, status, scheduled_date, stakes_amount, last_proposed_by")
          .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
          .in("status", ["pending", "active"]).order("created_at", { ascending: false }).limit(10),
        carregarRecorde(userId),
        carregarPessoas([userId]),
        (supabase as any).rpc("x1_lutas_ao_vivo"),
      ]);
      if (!vivo) return;
      setR(rec);
      setEu(meMap[userId] || { user_id: userId, nome: "Você", avatar_url: null });
      const vivas = ((lv.data as any[]) || []).filter((v) => !v.minha_luta).length;
      const lista = (rows as any[]) || [];
      const ativa = lista.find((c) => c.status === "active" && c.scheduled_date === hoje);
      const desafio = lista.find((c) => c.status === "pending" && c.last_proposed_by !== userId);
      const outroId = (c: any) => (c.challenger_id === userId ? c.opponent_id : c.challenger_id);

      if (ativa) {
        const { data } = await (supabase as any).rpc("x1_luta", { p_id: ativa.id });
        const row = ((data as any[]) || [])[0];
        if (!vivo || !row) return;
        const souCh = ativa.challenger_id === userId;
        setEstado({
          tipo: "luta", id: ativa.id,
          ele: { user_id: outroId(ativa), nome: souCh ? row.op_nome : row.ch_nome, avatar_url: souCh ? row.op_avatar : row.ch_avatar },
          meu: Number(souCh ? row.ch_total : row.op_total) || 0,
          dele: Number(souCh ? row.op_total : row.ch_total) || 0,
          stakes: Number(ativa.stakes_amount) || 0,
        });
        return;
      }
      if (desafio) {
        const m = await carregarPessoas([outroId(desafio)]);
        if (!vivo) return;
        setEstado({ tipo: "desafio", id: desafio.id, ele: m[outroId(desafio)] || { user_id: outroId(desafio), nome: "Vendedor", avatar_url: null }, stakes: Number(desafio.stakes_amount) || 0, quando: desafio.scheduled_date === hoje ? "hoje" : "amanhã" });
        return;
      }
      const { data: op } = await (supabase as any).rpc("x1_oponentes", { p_filtro: "liga", p_busca: null });
      const cands = ((op as any[]) || []).map((o) => ({ ...o, diferenca: Number(o.diferenca) || 0 }));
      const alvo = cands.find((o) => o.na_arena) || cands.find((o) => o.diferenca > 0) || cands[0];
      if (!vivo) return;
      if (alvo) setEstado({ tipo: "rival", ele: { user_id: alvo.user_id, nome: alvo.nome, avatar_url: alvo.avatar_url }, posicao: alvo.posicao ?? null, diferenca: alvo.diferenca, vivas });
      else setEstado({ tipo: "primeira", vivas });
    })().catch(() => { /* offline: sem card */ });
    return () => { vivo = false; };
  }, [userId]);

  if (!userId || !estado || !eu) return null;

  const prox = proximaPatente(r.patente);
  const corPat = patenteCor(r.patente);
  const fundo = estado.tipo === "luta"
    ? "radial-gradient(120% 90% at 50% 0%,#2a0c11 0%,#140508 45%,#0b0b0d 100%)"
    : "radial-gradient(120% 90% at 15% 0%,#1f1706 0%,#140b06 45%,#0b0b0d 100%)";
  const borda = estado.tipo === "luta" ? `${RED}77` : `${GOLD}66`;

  return (
    <button type="button"
      onClick={() => navigate(estado.tipo === "luta" || estado.tipo === "desafio" ? `/x1/luta/${estado.id}` : estado.tipo === "rival" ? `/x1/escolher?alvo=${estado.ele.user_id}` : "/x1")}
      className="w-full text-left rounded-[24px] p-4 relative overflow-hidden active:scale-[0.99] transition-transform"
      style={{ background: fundo, border: `1.5px solid ${borda}`, boxShadow: `0 26px 60px -34px ${estado.tipo === "luta" ? RED : GOLD}cc` }}>
      <span className="x1-shine" />

      {/* cabeçalho: selo + patente/XP */}
      <div className="flex items-center justify-between relative z-[1]">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black tracking-[.14em]"
          style={estado.tipo === "luta"
            ? { background: "#2a0c11", border: `1px solid ${RED}66`, color: "#ff7d8c" }
            : { background: "#1a1305", border: "1px solid #3a2f0c", color: GOLD }}>
          {estado.tipo === "luta" ? <><i className="w-[6px] h-[6px] rounded-full x1-live" style={{ background: RED }} /> AO VIVO</> : "ARENA X1"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: `${corPat}1a`, border: `1px solid ${corPat}66`, color: corPat }}>
          {r.patente} · {r.pontos} XP
        </span>
      </div>

      {/* ===== LUTA AO VIVO ===== */}
      {estado.tipo === "luta" && (() => {
        const lidero = estado.meu > estado.dele; const atras = estado.dele > estado.meu;
        const soma = estado.meu + estado.dele;
        const pct = soma > 0 ? Math.round((estado.meu / soma) * 100) : 50;
        return (
          <>
            <div className="flex items-center gap-2 mt-3.5 relative z-[1]">
              <div className="flex-1 flex items-center gap-2.5 min-w-0">
                <X1Avatar url={eu.avatar_url} nome={eu.nome} size={52} cor={GOLD} style={{ borderWidth: 3, boxShadow: `0 0 0 5px ${GOLD}1a, 0 0 26px ${GOLD}55` }} />
                <div className="min-w-0"><p className="text-[22px] font-black tabular-nums leading-none" style={{ color: lidero ? OK : "#fff" }}>{fmt(estado.meu)}</p><p className="text-[10px] font-black tracking-[.12em] mt-1" style={{ color: GOLD }}>VOCÊ</p></div>
              </div>
              <span className="x1-vs-glow text-[26px] font-black italic shrink-0" style={{ color: GOLD }}>VS</span>
              <div className="flex-1 flex items-center gap-2.5 justify-end text-right min-w-0">
                <div className="min-w-0"><p className="text-[22px] font-black tabular-nums leading-none" style={{ color: atras ? "#ff7d8c" : "#fff" }}>{fmt(estado.dele)}</p><p className="text-[10px] font-black tracking-[.12em] mt-1 truncate" style={{ color: "#ff7d8c" }}>{primeiroNome(estado.ele.nome).toUpperCase()}</p></div>
                <X1Avatar url={estado.ele.avatar_url} nome={estado.ele.nome} size={52} cor={RED} style={{ borderWidth: 3, boxShadow: `0 0 0 5px ${RED}1a, 0 0 26px ${RED}55` }} />
              </div>
            </div>
            <div className="flex gap-1.5 mt-3 relative z-[1]">
              <div className="flex-1 h-[12px] rounded-[6px] overflow-hidden" style={{ background: "#1a0a0e", border: "1px solid rgba(255,255,255,.08)" }}><i className="block h-full rounded-[6px] transition-all duration-700" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#1f8f5c,#3DD68C)", boxShadow: "0 0 12px #3DD68C88" }} /></div>
              <div className="flex-1 h-[12px] rounded-[6px] overflow-hidden" style={{ background: "#1a0a0e", border: "1px solid rgba(255,255,255,.08)" }}><i className="block h-full rounded-[6px] ml-auto transition-all duration-700" style={{ width: `${100 - pct}%`, background: "linear-gradient(90deg,#c8172f,#ff5a6e)", boxShadow: "0 0 12px #F2465A88" }} /></div>
            </div>
            <p className="text-[12px] font-black mt-2 relative z-[1]" style={{ color: lidero ? OK : atras ? "#ff7d8c" : "#b3ab9c" }}>
              {lidero ? `Você lidera por ${fmt(estado.meu - estado.dele)}` : atras ? `Uma venda de ${fmt(Math.ceil(estado.dele - estado.meu))} vira o jogo` : "Empatados — a próxima venda decide"}
              <span className="font-medium" style={{ color: "#8a8378" }}> · fecha 23:59{estado.stakes > 0 ? ` · volta ${fmt(voltaPraVoce(estado.stakes))}` : ""}</span>
            </p>
            <span className="x1-btn vermelho x1-pulse mt-3 relative z-[1]" style={{ height: 48 }}><Flame className="w-4 h-4" strokeWidth={2.6} /> DAR UM GOLPE · VENDER</span>
          </>
        );
      })()}

      {/* ===== DESAFIO RECEBIDO ===== */}
      {estado.tipo === "desafio" && (
        <>
          <div className="flex items-center gap-3 mt-3.5 relative z-[1]">
            <X1Avatar url={estado.ele.avatar_url} nome={estado.ele.nome} size={56} cor={RED} style={{ borderWidth: 3, boxShadow: `0 0 0 5px ${RED}1a, 0 0 26px ${RED}55` }} />
            <span className="x1-vs-glow text-[22px] font-black italic" style={{ color: GOLD }}>VS</span>
            <X1Avatar url={eu.avatar_url} nome={eu.nome} size={56} cor={GOLD} style={{ borderWidth: 3, boxShadow: `0 0 0 5px ${GOLD}1a, 0 0 26px ${GOLD}55` }} />
            <div className="flex-1 min-w-0 text-right">
              <p className="text-[10px] font-black tracking-[.14em]" style={{ color: "#ff7d8c" }}>TE DESAFIOU</p>
              <p className="text-[11.5px] mt-0.5" style={{ color: "#b3ab9c" }}>{estado.quando} · {estado.stakes > 0 ? `${fmt(estado.stakes)} · volta ${fmt(voltaPraVoce(estado.stakes))}` : "amistoso"}</p>
            </div>
          </div>
          <p className="text-[17px] font-black leading-tight mt-3 relative z-[1]">{primeiroNome(estado.ele.nome)} quer saber quem vende mais {estado.quando}.<br /><span style={{ color: GOLD }}>Topa a luta?</span></p>
          <span className="x1-btn ouro x1-pulse mt-3 relative z-[1]" style={{ height: 48 }}><Check className="w-5 h-5" strokeWidth={3} /> LUTAR · ACEITAR</span>
        </>
      )}

      {/* ===== RIVAL ===== */}
      {estado.tipo === "rival" && (
        <>
          <div className="flex items-center gap-2 mt-3.5 relative z-[1]">
            <div className="flex-1 flex items-center gap-2.5 min-w-0">
              <X1Avatar url={eu.avatar_url} nome={eu.nome} size={52} cor={GOLD} style={{ borderWidth: 3, boxShadow: `0 0 0 5px ${GOLD}1a, 0 0 26px ${GOLD}55` }} />
              <div className="min-w-0"><p className="text-[13.5px] font-black truncate">{primeiroNome(eu.nome)}</p><p className="text-[10.5px]" style={{ color: "#8a8378" }}>{r.vitorias}V {r.derrotas}D{r.sequencia >= 2 ? ` · ${r.sequencia} seguidas` : ""}</p></div>
            </div>
            <span className="x1-vs-glow text-[26px] font-black italic shrink-0" style={{ color: GOLD }}>VS</span>
            <div className="flex-1 flex items-center gap-2.5 justify-end text-right min-w-0">
              <div className="min-w-0"><p className="text-[13.5px] font-black truncate">{primeiroNome(estado.ele.nome)}</p><p className="text-[10.5px] truncate" style={{ color: "#ff7d8c" }}>{estado.posicao ? `#${estado.posicao}` : "na arena"}{estado.diferenca > 0 ? ` · ${fmt(estado.diferenca)} na frente` : ""}</p></div>
              <X1Avatar url={estado.ele.avatar_url} nome={estado.ele.nome} size={52} cor={RED} style={{ borderWidth: 3, boxShadow: `0 0 0 5px ${RED}1a, 0 0 26px ${RED}55` }} />
            </div>
          </div>
          {/* XP */}
          <div className="mt-3 relative z-[1]">
            <div className="flex items-center justify-between text-[9.5px] font-black tracking-[.14em]" style={{ color: GOLD }}>
              <span>XP · {r.pontos}{r.pontos_proxima != null ? ` / ${r.pontos_proxima}` : ""}</span>
              <span>{prox ? `→ ${prox}` : "LENDA"}</span>
            </div>
            <div className="h-[9px] rounded-full overflow-hidden mt-1" style={{ background: "rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.08)" }}>
              <i className="block h-full rounded-full" style={{ width: `${Math.round(xpPct(r) * 100)}%`, background: "linear-gradient(90deg,#B88700,#FFC63A)", boxShadow: "0 0 10px #F5B800" }} />
            </div>
          </div>
          <p className="text-[16px] font-black leading-tight mt-2.5 relative z-[1]">
            {estado.diferenca > 0 ? <>Ele tá na sua frente no ranking.<br /><span style={{ color: GOLD }}>Resolve isso hoje?</span></> : <>Quem vende mais até 23:59?<br /><span style={{ color: GOLD }}>Chama ele pra luta.</span></>}
          </p>
          <span className="x1-btn ouro x1-pulse mt-3 relative z-[1]" style={{ height: 48 }}><Swords className="w-5 h-5" strokeWidth={2.6} /> LUTAR COM {primeiroNome(estado.ele.nome).toUpperCase()}</span>
          {estado.vivas > 0 && (
            <p className="text-[11px] mt-2 relative z-[1] flex items-center justify-center gap-1" style={{ color: "#8a8378" }}>
              <i className="w-[6px] h-[6px] rounded-full x1-live" style={{ background: RED }} /> {estado.vivas} {estado.vivas === 1 ? "luta rolando" : "lutas rolando"} agora <ChevronRight className="w-3 h-3" />
            </p>
          )}
        </>
      )}

      {/* ===== PRIMEIRA LUTA ===== */}
      {estado.tipo === "primeira" && (
        <>
          <div className="flex items-center gap-3 mt-3.5 relative z-[1]">
            <X1Avatar url={eu.avatar_url} nome={eu.nome} size={56} cor={GOLD} style={{ borderWidth: 3, boxShadow: `0 0 0 5px ${GOLD}1a, 0 0 26px ${GOLD}55` }} />
            <p className="text-[17px] font-black leading-tight">Sua primeira luta.<br /><span style={{ color: GOLD }}>Quem vende mais no dia leva.</span></p>
          </div>
          <p className="text-[12px] mt-2 relative z-[1]" style={{ color: "#b3ab9c" }}>Amistoso, sem dinheiro. Vale XP e patente. {estado.vivas > 0 ? `${estado.vivas} ${estado.vivas === 1 ? "luta rolando" : "lutas rolando"} agora.` : ""}</p>
          <span className="x1-btn ouro x1-pulse mt-3 relative z-[1]" style={{ height: 48 }}><Swords className="w-5 h-5" strokeWidth={2.6} /> ENTRAR NA ARENA</span>
        </>
      )}

      {/* sequência em chamas */}
      {r.sequencia >= 2 && estado.tipo !== "luta" && (
        <p className="text-[10.5px] font-black mt-2 relative z-[1] text-center" style={{ color: HOT }}>{r.sequencia} vitórias seguidas · não deixa esfriar</p>
      )}
    </button>
  );
}
