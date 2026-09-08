/* ============================================================
   CARD DA ARENA X1 NO DASHBOARD — 1º card depois do Foco. Mostra UMA coisa:
     1) alguém te chamou → TOPO / ver
     2) duelo rolando hoje → placar ao vivo + VENDER AGORA
     3) senão → rival logo acima no ranking ("resolve isso hoje?") ou,
        sem ranking, o convite pro 1º amistoso.
   Fotos reais (pedido do Rick). Sem API externa — só Supabase.
   ============================================================ */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Swords, Flame, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { X1Avatar } from "@/components/x1/X1Avatar";
import { carregarPessoas, carregarRecorde, fmt, primeiroNome, type Pessoa } from "@/components/x1/x1-lib";

const GOLD = "#F5B800";
const RED = "#F2465A";
const OK = "#3DD68C";

type Estado =
  | { tipo: "convite"; id: string; ele: Pessoa; stakes: number; quando: string }
  | { tipo: "ativo"; ele: Pessoa; my: number; opp: number; stakes: number }
  | { tipo: "rival"; ele: Pessoa; posicao: number; diferenca: number; abertas: number }
  | { tipo: "primeiro"; abertas: number };

const fundo = "radial-gradient(120% 90% at 15% 0%,#2a0c11 0%,#140508 45%,#0b0b0d 100%)";

export function X1HomeBanner({ userId }: { userId: string | undefined }) {
  const navigate = useNavigate();
  const [eu, setEu] = useState<{ p: Pessoa; vitorias: number; patente: string } | null>(null);
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    (async () => {
      const hoje = getBrazilDate();
      const [{ data }, rec, meMap, ab] = await Promise.all([
        supabase.from("x1_challenges" as any)
          .select("id, challenger_id, opponent_id, status, scheduled_date, stakes_amount, last_proposed_by")
          .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
          .in("status", ["pending", "active"]).order("created_at", { ascending: false }).limit(10),
        carregarRecorde(userId),
        carregarPessoas([userId]),
        (supabase as any).rpc("x1_chamadas_abertas"),
      ]);
      if (!vivo) return;
      setEu({ p: meMap[userId] || { user_id: userId, nome: "Você", avatar_url: null }, vitorias: rec.vitorias, patente: rec.patente });
      const abertas = ((ab.data as any[]) || []).filter((a) => a.challenger_id !== userId).length;
      const rows = (data as any[]) || [];
      const ativo = rows.find((c) => c.status === "active" && c.scheduled_date === hoje);
      const convite = rows.find((c) => c.status === "pending" && c.last_proposed_by !== userId);
      const outroId = (c: any) => (c.challenger_id === userId ? c.opponent_id : c.challenger_id);
      if (ativo) {
        const [m, { data: pl }] = await Promise.all([carregarPessoas([outroId(ativo)]), (supabase as any).rpc("x1_placar", { p_id: ativo.id })]);
        const row = ((pl as any[]) || [])[0];
        const iAmCh = ativo.challenger_id === userId;
        if (vivo) setEstado({ tipo: "ativo", ele: m[outroId(ativo)] || { user_id: outroId(ativo), nome: "Rival", avatar_url: null }, stakes: Number(ativo.stakes_amount) || 0, my: row ? Number(iAmCh ? row.challenger_total : row.opponent_total) || 0 : 0, opp: row ? Number(iAmCh ? row.opponent_total : row.challenger_total) || 0 : 0 });
        return;
      }
      if (convite) {
        const m = await carregarPessoas([outroId(convite)]);
        if (vivo) setEstado({ tipo: "convite", id: convite.id, ele: m[outroId(convite)] || { user_id: outroId(convite), nome: "Alguém", avatar_url: null }, stakes: Number(convite.stakes_amount) || 0, quando: convite.scheduled_date === hoje ? "hoje" : "amanhã" });
        return;
      }
      const { data: rv } = await (supabase as any).rpc("x1_rivais");
      const rivais = ((rv as any[]) || []).map((r) => ({ ...r, diferenca: Number(r.diferenca) || 0 }));
      const acima = rivais.filter((r) => r.diferenca > 0).sort((a, b) => a.diferenca - b.diferenca)[0] || rivais[0];
      if (!vivo) return;
      if (acima) setEstado({ tipo: "rival", ele: { user_id: acima.user_id, nome: acima.nome, avatar_url: acima.avatar_url }, posicao: acima.posicao, diferenca: acima.diferenca, abertas });
      else setEstado({ tipo: "primeiro", abertas });
    })().catch(() => { /* offline: sem card */ });
    return () => { vivo = false; };
  }, [userId]);

  if (!userId || !estado || !eu) return null;

  const Topo = ({ direita }: { direita: React.ReactNode }) => (
    <div className="flex items-center justify-between relative z-[1]">
      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold border" style={{ background: "#1a1305", borderColor: "#3a2f0c", color: GOLD }}>ARENA X1</span>
      {direita}
    </div>
  );
  const Faces = ({ ele, sub, subEle }: { ele: Pessoa; sub: string; subEle: string }) => (
    <div className="flex items-center gap-2 mt-3 relative z-[1]">
      <div className="flex-1 flex items-center gap-2.5 min-w-0">
        <X1Avatar url={eu.p.avatar_url} nome={eu.p.nome} size={44} cor={GOLD} />
        <div className="min-w-0"><p className="text-[10px] font-black tracking-[.14em]" style={{ color: GOLD }}>VOCÊ</p><p className="text-[12px] font-bold truncate" style={{ color: "#e9e4d8" }}>{sub}</p></div>
      </div>
      <span className="text-[18px] font-black italic" style={{ color: GOLD, textShadow: `0 0 14px ${GOLD}88` }}>VS</span>
      <div className="flex-1 flex items-center gap-2.5 justify-end text-right min-w-0">
        <div className="min-w-0"><p className="text-[10px] font-black tracking-[.14em] truncate" style={{ color: "#ff7d8c" }}>{primeiroNome(ele.nome).toUpperCase()}</p><p className="text-[12px] font-bold truncate" style={{ color: "#e9e4d8" }}>{subEle}</p></div>
        <X1Avatar url={ele.avatar_url} nome={ele.nome} size={44} cor={RED} />
      </div>
    </div>
  );

  return (
    <div className="orbis-card-in rounded-[22px] p-4 relative overflow-hidden" style={{ background: fundo, border: `1px solid ${RED}55` }}>
      {estado.tipo === "ativo" && (() => {
        const lidero = estado.my > estado.opp; const atras = estado.opp > estado.my;
        const pct = estado.my + estado.opp > 0 ? Math.round((estado.my / (estado.my + estado.opp)) * 100) : 50;
        return (
          <>
            <Topo direita={<span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold border" style={{ background: "#2a0c11", borderColor: `${RED}66`, color: "#ff7d8c" }}><i className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: RED }} /> AO VIVO{estado.stakes > 0 ? ` · POTE ${fmt(estado.stakes * 2)}` : " · AMISTOSO"}</span>} />
            <Faces ele={estado.ele} sub={fmt(estado.my)} subEle={fmt(estado.opp)} />
            <div className="h-2 rounded-full mt-2.5 overflow-hidden" style={{ background: "#2a1418" }}><i className="block h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#1f8f5c,#3DD68C)" }} /></div>
            <p className="text-[11.5px] font-extrabold mt-1.5" style={{ color: lidero ? OK : atras ? "#ff7d8c" : "#b3ab9c" }}>{lidero ? `Você lidera por ${fmt(estado.my - estado.opp)}` : atras ? `${primeiroNome(estado.ele.nome)} lidera por ${fmt(estado.opp - estado.my)} · uma venda vira` : "Empatados — a próxima venda decide"} <span style={{ color: "#8a8378", fontWeight: 500 }}>· fecha 23:59</span></p>
            <button type="button" onClick={() => navigate("/defcon")} className="w-full h-[46px] rounded-[13px] mt-3 inline-flex items-center justify-center gap-2 text-[13.5px] font-black" style={{ background: "linear-gradient(160deg,#7f1d1d,#450a0a)", color: "#fecaca", border: "1px solid #ef444499" }}><Flame className="w-4 h-4" strokeWidth={2.6} /> VENDER AGORA · DEFCON</button>
          </>
        );
      })()}

      {estado.tipo === "convite" && (
        <>
          <Topo direita={<span className="text-[10px] font-black tracking-[.14em]" style={{ color: "#ff7d8c" }}>VOCÊ FOI DESAFIADO</span>} />
          <Faces ele={estado.ele} sub={`${eu.vitorias}V · ${eu.patente}`} subEle={`${estado.quando} · ${estado.stakes > 0 ? `${fmt(estado.stakes)} cada` : "amistoso"}`} />
          <p className="text-[17px] font-black leading-tight mt-3 relative z-[1]">{primeiroNome(estado.ele.nome)} quer saber quem vende mais {estado.quando}.<br /><span style={{ color: GOLD }}>Topa?</span></p>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => navigate("/x1")} className="orbis-cta flex-[1.4] h-[46px]"><Check className="w-4 h-4" strokeWidth={3} /> TOPO · ACEITAR</button>
            <button type="button" onClick={() => navigate("/x1")} className="flex-1 h-[46px] rounded-[13px] text-[12.5px] font-black" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>ver arena</button>
          </div>
        </>
      )}

      {estado.tipo === "rival" && (
        <>
          <Topo direita={estado.abertas > 0 ? <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold border" style={{ background: "#0d1f16", borderColor: `${OK}55`, color: OK }}><i className="w-1.5 h-1.5 rounded-full" style={{ background: OK }} /> {estado.abertas} {estado.abertas === 1 ? "chamada aberta" : "chamadas abertas"}</span> : <span className="text-[10px] font-black tracking-[.14em]" style={{ color: "#8a8378" }}>{eu.vitorias}V · {eu.patente}</span>} />
          <Faces ele={estado.ele} sub={`${eu.vitorias}V · ${eu.patente}`} subEle={estado.diferenca > 0 ? `#${estado.posicao} · ${fmt(estado.diferenca)} na frente` : `#${estado.posicao} · ${fmt(Math.abs(estado.diferenca))} atrás`} />
          <p className="text-[17px] font-black leading-tight mt-3 relative z-[1]">{estado.diferenca > 0 ? "Ele tá logo acima de você no ranking." : "Ele tá colado atrás de você no ranking."}<br /><span style={{ color: GOLD }}>Resolve isso hoje?</span></p>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => navigate(`/x1?desafiar=${estado.ele.user_id}`)} className="orbis-cta flex-[1.4] h-[46px]"><Swords className="w-4 h-4" strokeWidth={2.6} /> CHAMAR {primeiroNome(estado.ele.nome).toUpperCase()}</button>
            <button type="button" onClick={() => navigate("/x1")} className="flex-1 h-[46px] rounded-[13px] text-[12.5px] font-black" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>ver arena</button>
          </div>
        </>
      )}

      {estado.tipo === "primeiro" && (
        <>
          <Topo direita={estado.abertas > 0 ? <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold border" style={{ background: "#0d1f16", borderColor: `${OK}55`, color: OK }}><i className="w-1.5 h-1.5 rounded-full" style={{ background: OK }} /> {estado.abertas} {estado.abertas === 1 ? "chamada aberta" : "chamadas abertas"}</span> : null} />
          <div className="flex items-center gap-3 mt-3 relative z-[1]">
            <X1Avatar url={eu.p.avatar_url} nome={eu.p.nome} size={48} cor={GOLD} />
            <p className="text-[17px] font-black leading-tight">Seu primeiro amistoso.<br /><span style={{ color: GOLD }}>Quem vende mais no dia leva.</span></p>
          </div>
          <p className="text-[12px] mt-2 relative z-[1]" style={{ color: "#b3ab9c" }}>Sem dinheiro, só honra. Vale patente e recorde. {estado.abertas > 0 ? "Tem gente esperando alguém topar agora." : "Abra uma chamada geral e espere alguém topar."}</p>
          <button type="button" onClick={() => navigate("/x1")} className="orbis-cta w-full h-[46px] mt-3"><Swords className="w-4 h-4" strokeWidth={2.6} /> {estado.abertas > 0 ? "VER QUEM TÁ CHAMANDO" : "ENTRAR NA ARENA"}</button>
        </>
      )}
    </div>
  );
}
