/* ============================================================
   DEFCON 4 OFFLINE — a MESMA tela do DEFCON, sem servidor.

   Pedido do Rick (01/09): "o modo offline não pode ser aquela tela
   de placar, tem que ser a tela do DEFCON 4". Então:
   - Tela de início  → DefconStartScreen (a real)
   - Rodando         → DefconRunning (a real: venda, abordagem,
                       gorjeta, custo, ocorrência, pausar, encerrar)
   - Pausa           → DefconLunchPause (a real)
   - Encerrou        → resumo offline + "sobe sozinho quando o sinal voltar"
   O motor é o useDefconOffline (tudo no celular). Quando a internet
   volta, offline-sync joga o dia no MESMO funil do DEFCON → ranking.

   Rota: /offline (fora do Layout, liberada no PaywallGate).
   Chegada: OfflineGate ("ATIVAR MODO OFFLINE") ou direto.
   ============================================================ */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloudOff, Cloud, RefreshCw, Check, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineStatus } from "@/shared/hooks/use-online-status";
import { useDefconOffline } from "@/hooks/useDefconOffline";
import { DefconStartScreen } from "@/components/defcon/DefconStartScreen";
import { DefconRunning } from "@/components/defcon/DefconRunning";
import { DefconLunchPause } from "@/components/defcon/DefconLunchPause";
import { Ring } from "@/shared/motion";
import { carregarDiaOffline, hojeBR } from "@/shared/lib/offline-day";
import { syncAllPendingData } from "@/shared/lib/offline-sync";

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

function userIdLembrado(): string | null {
  try { return localStorage.getItem("orbis_ultimo_user_id"); } catch { return null; }
}

/* Tarja fina no topo: deixa claro que é offline e permite ajustar a meta lembrada. */
function TarjaOffline({ online, meta, onMeta, mostrarMeta }: { online: boolean; meta: number; onMeta?: (n: number) => void; mostrarMeta: boolean }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const confirmar = () => {
    const n = Number(valor.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n) && n > 0) onMeta?.(n);
    setEditando(false); setValor("");
  };
  return (
    <div className="fixed inset-x-0 z-[55] flex justify-center px-3" style={{ top: "max(env(safe-area-inset-top), 8px)", pointerEvents: "none" }}>
      <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.08em]"
        style={{ background: "rgba(17,17,17,.94)", border: "1px solid rgba(255,255,255,.12)", color: online ? "#3DD68C" : "#B9B3A6", pointerEvents: "auto" }}>
        {online ? <Cloud size={12} /> : <CloudOff size={12} />}
        {online ? "Sinal voltou · sobe sozinho" : "DEFCON 4 offline"}
        {mostrarMeta && !editando && onMeta && (
          <button type="button" onClick={() => setEditando(true)} className="ml-1 normal-case tracking-normal font-semibold" style={{ color: "#F5B800" }}>
            meta {fmt(meta)} · ajustar
          </button>
        )}
        {editando && (
          <span className="flex items-center gap-1 normal-case tracking-normal">
            <input autoFocus inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={String(meta)}
              onKeyDown={(e) => e.key === "Enter" && confirmar()}
              className="w-20 h-6 rounded-md px-2 text-[12px] font-bold outline-none" style={{ background: "#000", border: "1px solid rgba(245,184,0,.4)", color: "#F4F1EA" }} />
            <button type="button" onClick={confirmar} className="h-6 px-2 rounded-md text-[11px] font-extrabold" style={{ background: "#F5B800", color: "#1A1200" }}>OK</button>
          </span>
        )}
      </div>
    </div>
  );
}

export default function ModoOffline() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const userId = user?.id ?? userIdLembrado();
  const d = useDefconOffline(userId);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const sincronizarAgora = async () => {
    if (!online) { setMensagem("Ainda sem internet — assim que voltar, sobe sozinho."); return; }
    setSincronizando(true);
    try {
      await syncAllPendingData();
      const dia = userId ? carregarDiaOffline(userId, hojeBR()) : null;
      setMensagem(dia?.synced_at ? "Tudo sincronizado! Suas vendas já estão no relatório e no ranking." : "Sincronizando… se não subir agora, sobe na próxima abertura do app.");
    } finally { setSincronizando(false); }
  };

  if (!userId) {
    return (
      <div className="fixed inset-0 bg-black text-[#F4F1EA] flex flex-col items-center justify-center px-8 text-center">
        <CloudOff size={40} style={{ color: "#7E7869" }} />
        <h1 className="font-display text-[20px] font-extrabold mt-4">Sem internet e sem login salvo</h1>
        <p className="text-[13px] mt-2" style={{ color: "#B9B3A6" }}>Abre o Orbis uma vez com sinal pra ele lembrar de você. Depois o DEFCON offline funciona sempre.</p>
        <button type="button" onClick={() => navigate("/")} className="orbis-cta w-full max-w-xs mt-6">Voltar</button>
      </div>
    );
  }

  if (d.loading) {
    return <div className="min-h-[100dvh] bg-black flex items-center justify-center"><div className="text-2xl font-mono text-destructive animate-pulse">CARREGANDO DEFCON 4...</div></div>;
  }

  const tarja = <TarjaOffline online={online} meta={d.dailyGoal} onMeta={d.setDailyGoal} mostrarMeta={d.phase === "idle"} />;

  if (d.phase === "idle") {
    return (
      <>
        {tarja}
        <DefconStartScreen dailyGoal={d.dailyGoal} totalBlocks={d.totalBlocks} onStart={d.startChallenge} onExit={() => navigate("/")} onboardingMode />
      </>
    );
  }

  if (d.phase === "lunch_pause") {
    return (
      <>
        {tarja}
        <DefconLunchPause lunchPauseRemaining={d.lunchPauseRemaining} totalSold={d.totalSold} onSkip={d.skipLunchPause} />
      </>
    );
  }

  if (d.phase === "running") {
    return (
      <>
        {tarja}
        <DefconRunning
          userId={userId}
          dailyGoal={d.dailyGoal}
          totalSold={d.totalSold}
          currentBlock={d.currentBlock}
          currentBlockIndex={d.currentBlockIndex}
          totalBlocks={d.totalBlocks}
          remainingSeconds={d.remainingSeconds}
          blockStartedAt={d.blockStartedAt}
          blockEndTime={d.blockEndTime}
          lunchPauseUsed={false}
          blockApproaches={d.blockApproaches}
          totalApproaches={d.totalApproaches}
          totalSalesCount={d.totalSalesCount}
          blockSalesCount={d.blockSalesCount}
          onAddSale={(amount, method) => { void d.addSale(amount, method ?? "dinheiro"); }}
          onAddTip={(amount) => { void d.addTip(amount); }}
          onAddApproach={d.addApproach}
          onAddOccurrence={(text) => { void d.addOccurrence(text); }}
          onEnd={() => { void d.endChallenge(); }}
          onLunchPause={(min) => { void d.startLunchPause(min); }}
          sessionSales={d.sessionSales}
          onDeleteSale={(s) => { void d.deleteSale(s); }}
          onboardingMode /* sem servidor: não debita estoque nem grava cliente — só o dia offline */
        />
      </>
    );
  }

  // ---- finished: resumo offline ----
  const t = d.totais;
  const pct = d.dailyGoal > 0 ? Math.min(100, (t.total / d.dailyGoal) * 100) : 0;
  const bateu = d.dailyGoal > 0 && t.total >= d.dailyGoal;
  return (
    <div className="min-h-[100dvh] bg-black text-[#F4F1EA] px-4 pb-10 orbis-stagger" style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate("/")} className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "#B9B3A6" }}><ArrowLeft size={16} /> Voltar</button>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[.08em]"
          style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)", color: online ? "#3DD68C" : "#B9B3A6" }}>
          {online ? <><Cloud size={12} /> Com sinal</> : <><CloudOff size={12} /> Offline</>}
        </span>
      </div>

      <p className="orbis-section mt-5">DEFCON 4 · {bateu ? "meta batida" : "dia encerrado"}</p>
      <h1 className="font-display text-[24px] font-extrabold mt-1 leading-tight">{bateu ? "Você bateu a meta." : "Corre fechado."}</h1>
      <p className="text-[13px] mt-1" style={{ color: "#7E7869" }}>Salvo no seu celular — sobe sozinho quando o sinal voltar.</p>

      <div className={`mt-4 rounded-[22px] border p-[17px] flex items-center gap-4 ${bateu ? "orbis-victory" : ""}`}
        style={{ background: "linear-gradient(160deg,#1C1608 0%,#111 60%)", borderColor: "rgba(245,184,0,.28)" }}>
        <div className="min-w-0 flex-1">
          <p className="orbis-label" style={{ color: "#F5B800" }}>Vendido hoje</p>
          <p className="orbis-num text-[34px] font-extrabold leading-none mt-2">{fmt(t.total)}</p>
          <p className="text-[12.5px] mt-2" style={{ color: "#B9B3A6" }}>Meta <b style={{ color: "#F4F1EA" }}>{fmt(d.dailyGoal)}</b> · {t.vendas} {t.vendas === 1 ? "venda" : "vendas"} · {d.totalApproaches} abord. · {d.workedMinutes} min</p>
        </div>
        <Ring pct={pct} size={80} stroke={8} label={<b className="orbis-num text-[16px]">{Math.round(pct)}%</b>} />
      </div>

      <div className="mt-3 rounded-[16px] border grid grid-cols-4 text-center py-3" style={{ background: "#111", borderColor: "rgba(255,255,255,.09)" }}>
        {([["Dinheiro", t.dinheiro], ["Pix", t.pix], ["Cartão", t.cartao], ["Gorjeta", t.gorjeta]] as const).map(([l, v], i) => (
          <div key={l} style={i > 0 ? { borderLeft: "1px solid rgba(255,255,255,.1)" } : undefined}>
            <p className="orbis-section">{l}</p>
            <b className="orbis-num block text-[14px] mt-1">{fmt(v)}</b>
          </div>
        ))}
      </div>

      {d.ocorrencias.length > 0 && (
        <div className="mt-3 rounded-[16px] border px-4 py-3" style={{ background: "#111", borderColor: "rgba(255,255,255,.09)" }}>
          <p className="orbis-section">Ocorrências do dia</p>
          {d.ocorrencias.map((o, i) => <p key={i} className="text-[13px] mt-1.5" style={{ color: "#B9B3A6" }}>· {o.text}</p>)}
        </div>
      )}

      <button type="button" onClick={sincronizarAgora} disabled={sincronizando}
        className="orbis-press mt-3 w-full rounded-[16px] border px-4 py-3.5 flex items-center gap-3 text-left"
        style={{ borderColor: online ? "rgba(61,214,140,.35)" : "rgba(255,255,255,.09)", background: "#111" }}>
        <RefreshCw size={18} className={sincronizando ? "animate-spin" : ""} style={{ color: online ? "#3DD68C" : "#7E7869" }} />
        <span className="flex-1">
          <span className="block text-[14px] font-bold">{online ? "Sincronizar agora" : "Sincroniza sozinho quando o sinal voltar"}</span>
          <span className="block text-[11.5px]" style={{ color: "#7E7869" }}>{online ? "Joga as vendas no relatório e no ranking" : "Pode fechar o app — nada se perde"}</span>
        </span>
        {d.dia?.synced_at && <Check size={18} style={{ color: "#3DD68C" }} />}
      </button>
      {mensagem && <p className="text-[12.5px] text-center mt-3" style={{ color: "#B9B3A6" }}>{mensagem}</p>}

      <button type="button" onClick={d.reabrir} className="mt-4 w-full text-[13px] font-semibold" style={{ color: "#7E7869" }}>
        continuar vendendo (reabre o DEFCON)
      </button>
    </div>
  );
}
