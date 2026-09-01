/* ============================================================
   PLACAR OFFLINE — o Modo Foco sem internet.

   Funciona 100% no celular: meta do dia (lembrada da última vez
   online), total do dia, + venda (valor + dinheiro/pix/cartão),
   + abordagem, calote, lista com desfazer. Tudo em localStorage +
   fila de sync. Quando o sinal volta, sobe sozinho (offline-sync)
   e vira daily_sales/ranking como qualquer venda do DEFCON.

   Rota: /offline (fora do Layout — não depende de nada do servidor).
   Chegada: pelo OfflineGate ("Ativar modo offline") ou direto.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloudOff, Cloud, Plus, Users, AlertTriangle, X, ArrowLeft, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineStatus } from "@/shared/hooks/use-online-status";
import { AnimatedCurrency, Ring, useReducedMotion } from "@/shared/motion";
import {
  carregarDiaOffline, novoDiaOffline, salvarDiaOffline, totaisDoDia, metaDiaLembrada,
  hojeBR, type DiaOffline, type MetodoVenda,
} from "@/shared/lib/offline-day";
import { syncAllPendingData } from "@/shared/lib/offline-sync";

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

/* O usuário pode estar sem sessão carregada (offline + boot). O id fica
   também no localStorage pra o placar funcionar mesmo assim. */
function userIdLembrado(): string | null {
  try { return localStorage.getItem("orbis_ultimo_user_id"); } catch { return null; }
}

export default function ModoOffline() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const reduced = useReducedMotion();
  const userId = user?.id ?? userIdLembrado();

  const [dia, setDia] = useState<DiaOffline | null>(null);
  const [sheet, setSheet] = useState<null | "venda" | "calote">(null);
  const [valor, setValor] = useState("");
  const [metodo, setMetodo] = useState<MetodoVenda>("dinheiro");
  const [sincronizando, setSincronizando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // carrega (ou cria) o dia offline de hoje
  useEffect(() => {
    if (!userId) return;
    const existente = carregarDiaOffline(userId, hojeBR());
    if (existente) { setDia(existente); return; }
    const meta = metaDiaLembrada(userId) || 200;
    setDia(novoDiaOffline(userId, meta));
  }, [userId]);

  useEffect(() => { if (sheet) setTimeout(() => inputRef.current?.focus(), 50); }, [sheet]);

  const t = useMemo(() => (dia ? totaisDoDia(dia) : { dinheiro: 0, pix: 0, cartao: 0, total: 0, vendas: 0 }), [dia]);
  const pct = dia && dia.daily_goal > 0 ? Math.min(100, (t.total / dia.daily_goal) * 100) : 0;
  const falta = dia ? Math.max(0, dia.daily_goal - t.total) : 0;

  const atualizar = (novo: DiaOffline) => { setDia({ ...novo }); void salvarDiaOffline(novo); };

  const confirmarValor = () => {
    if (!dia) return;
    const n = Number(valor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return;
    if (sheet === "venda") {
      dia.sales.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, amount: Math.round(n * 100) / 100, method: metodo, at: new Date().toISOString() });
      if (navigator.vibrate) navigator.vibrate(30);
    } else if (sheet === "calote") {
      dia.calote = Math.round((dia.calote + n) * 100) / 100;
    }
    atualizar(dia);
    setValor(""); setSheet(null);
  };

  const desfazerVenda = (id: string) => {
    if (!dia) return;
    dia.sales = dia.sales.filter((s) => s.id !== id);
    atualizar(dia);
  };

  const maisAbordagem = () => {
    if (!dia) return;
    dia.approaches += 1;
    atualizar(dia);
    if (navigator.vibrate) navigator.vibrate(15);
  };

  const sincronizarAgora = async () => {
    if (!online) { setMensagem("Ainda sem internet — assim que voltar, sobe sozinho."); return; }
    setSincronizando(true);
    try {
      await syncAllPendingData();
      const d = userId ? carregarDiaOffline(userId, hojeBR()) : null;
      if (d?.synced_at) {
        setMensagem("Tudo sincronizado! Suas vendas já estão no relatório e no ranking.");
        setDia(d);
      } else {
        setMensagem("Sincronizando… se não subir agora, sobe na próxima abertura do app.");
      }
    } finally { setSincronizando(false); }
  };

  if (!userId) {
    return (
      <div className="fixed inset-0 bg-black text-[#F4F1EA] flex flex-col items-center justify-center px-8 text-center">
        <CloudOff size={40} style={{ color: "#7E7869" }} />
        <p className="font-display text-[20px] font-extrabold mt-4">Faz login uma vez com internet</p>
        <p className="text-[13px] mt-2" style={{ color: "#B9B3A6" }}>Depois disso o Placar Offline funciona sem sinal.</p>
        <button type="button" onClick={() => navigate("/auth")} className="orbis-cta w-full mt-6">IR PRO LOGIN</button>
      </div>
    );
  }
  if (!dia) return null;

  return (
    <div className="fixed inset-0 overflow-y-auto bg-black text-[#F4F1EA]">
      <div className="orbis-stagger max-w-md mx-auto px-4 pt-4 pb-32 space-y-3.5">
        {/* topo: sair + selo do modo */}
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate("/")} className="orbis-press inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "#B9B3A6" }}>
            <ArrowLeft size={16} /> Voltar
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[.08em]"
            style={online
              ? { background: "rgba(61,214,140,.12)", color: "var(--orbis-ok,#3DD68C)", border: "1px solid rgba(61,214,140,.35)" }
              : { background: "rgba(255,255,255,.06)", color: "#B9B3A6", border: "1px solid rgba(255,255,255,.12)" }}>
            {online ? <><Cloud size={12} /> Com sinal</> : <><CloudOff size={12} /> Modo offline</>}
          </span>
        </div>

        <div>
          <p className="orbis-section">{new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "")}</p>
          <h1 className="font-display text-[22px] font-extrabold leading-tight">Placar do dia</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: "#7E7869" }}>
            {dia.synced_at ? "Sincronizado com o servidor ✓" : "Salvo no seu celular — sobe sozinho quando o sinal voltar"}
          </p>
        </div>

        {/* placar */}
        <div className="rounded-[22px] border p-[17px] flex items-center gap-4"
          style={{ borderColor: "rgba(245,184,0,.28)", background: "linear-gradient(160deg,#1C1608 0%,#111 60%)" }}>
          <div className="min-w-0">
            <p className="orbis-label">Vendido hoje</p>
            <p className="font-display orbis-num text-[clamp(28px,9vw,38px)] font-extrabold leading-none mt-2 whitespace-nowrap">
              <AnimatedCurrency value={t.total} />
            </p>
            <p className="text-[12.5px] mt-2" style={{ color: "#B9B3A6" }}>
              Meta <b style={{ color: "#F4F1EA" }}>{fmt(dia.daily_goal)}</b>
              {falta > 0 ? <> · faltam <b style={{ color: "#F4F1EA" }}>{fmt(falta)}</b></> : <> · <b style={{ color: "var(--orbis-ok,#3DD68C)" }}>meta batida 🏆</b></>}
            </p>
          </div>
          <div className="ml-auto"><Ring pct={pct} size={80} stroke={8} label={<span className="text-[16px]">{Math.round(pct)}%</span>} /></div>
        </div>

        {/* ações */}
        <button type="button" onClick={() => { setMetodo("dinheiro"); setSheet("venda"); }} className="orbis-cta w-full">
          <Plus size={18} strokeWidth={2.6} /> Registrar venda
        </button>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={maisAbordagem}
            className="orbis-press rounded-2xl border px-3.5 py-3 text-left" style={{ borderColor: "var(--orbis-line,rgba(255,255,255,.09))", background: "#111" }}>
            <p className="orbis-section flex items-center gap-1.5"><Users size={13} /> Abordagens</p>
            <p className="font-display orbis-num text-[22px] font-extrabold mt-1.5 leading-none">{dia.approaches}</p>
            <p className="text-[11px] mt-1" style={{ color: "#7E7869" }}>toque pra somar +1</p>
          </button>
          <button type="button" onClick={() => setSheet("calote")}
            className="orbis-press rounded-2xl border px-3.5 py-3 text-left" style={{ borderColor: "rgba(255,92,92,.25)", background: "#111" }}>
            <p className="orbis-section flex items-center gap-1.5" style={{ color: "var(--orbis-calote,#FF5C5C)" }}><AlertTriangle size={13} /> Calote</p>
            <p className="font-display orbis-num text-[22px] font-extrabold mt-1.5 leading-none" style={{ color: "var(--orbis-calote,#FF5C5C)" }}>{fmt(dia.calote)}</p>
            <p className="text-[11px] mt-1" style={{ color: "#7E7869" }}>ficou de pagar</p>
          </button>
        </div>

        {/* por método */}
        <div className="rounded-2xl border px-3.5 py-3 grid grid-cols-3 text-center" style={{ borderColor: "var(--orbis-line,rgba(255,255,255,.09))", background: "#111" }}>
          {([["Dinheiro", t.dinheiro], ["Pix", t.pix], ["Cartão", t.cartao]] as const).map(([l, v], i) => (
            <div key={l} style={i === 1 ? { borderLeft: "1px solid rgba(255,255,255,.10)", borderRight: "1px solid rgba(255,255,255,.10)" } : undefined}>
              <p className="orbis-section">{l}</p>
              <p className="font-display orbis-num text-[15px] font-bold mt-1">{fmt(v)}</p>
            </div>
          ))}
        </div>

        {/* lista */}
        {dia.sales.length > 0 && (
          <div className="rounded-2xl border" style={{ borderColor: "var(--orbis-line,rgba(255,255,255,.09))", background: "#111" }}>
            <p className="orbis-section px-3.5 pt-3 pb-1">{t.vendas} {t.vendas === 1 ? "venda" : "vendas"} hoje</p>
            {[...dia.sales].reverse().map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-3.5 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
                <span className="text-[11px] font-bold uppercase tracking-[.06em] w-16" style={{ color: "#7E7869" }}>{s.method}</span>
                <span className="font-display orbis-num text-[15px] font-bold flex-1">{fmt(s.amount)}</span>
                <span className="text-[11px]" style={{ color: "#7E7869" }}>{new Date(s.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                <button type="button" onClick={() => desfazerVenda(s.id)} aria-label="Desfazer" className="orbis-press w-7 h-7 rounded-full flex items-center justify-center" style={{ color: "#7E7869", border: "1px solid rgba(255,255,255,.1)" }}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* sincronizar */}
        <button type="button" onClick={sincronizarAgora} disabled={sincronizando}
          className="orbis-press w-full rounded-2xl border px-3.5 py-3 flex items-center gap-3 text-left"
          style={{ borderColor: online ? "rgba(61,214,140,.35)" : "var(--orbis-line,rgba(255,255,255,.09))", background: "#111" }}>
          <RefreshCw size={18} className={sincronizando ? "animate-spin" : ""} style={{ color: online ? "var(--orbis-ok,#3DD68C)" : "#7E7869" }} />
          <span className="flex-1">
            <span className="block text-[14px] font-bold">{online ? "Sincronizar agora" : "Sincroniza sozinho quando o sinal voltar"}</span>
            <span className="block text-[11.5px]" style={{ color: "#7E7869" }}>{online ? "Joga as vendas no relatório e no ranking" : "Pode fechar o app — nada se perde"}</span>
          </span>
        </button>
        {mensagem && <p className="text-[12px] text-center" style={{ color: "#B9B3A6" }}>{mensagem}</p>}
      </div>

      {/* folha de valor (venda / calote) */}
      {sheet && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center">
          <button type="button" aria-label="Fechar" onClick={() => setSheet(null)} className="absolute inset-0" style={{ background: "rgba(0,0,0,.7)" }} />
          <div className={`relative w-full max-w-md rounded-t-[22px] border-t px-5 pt-4 pb-8 ${reduced ? "" : "orbis-card-in"}`}
            style={{ background: "#111", borderColor: "rgba(245,184,0,.3)" }}>
            <p className="font-display text-[17px] font-extrabold">{sheet === "venda" ? "Quanto foi a venda?" : "Quanto ficou de calote?"}</p>
            <div className="mt-3 rounded-2xl px-4 py-3 flex items-baseline gap-2" style={{ background: "#0A0A0A", border: "1px solid rgba(245,184,0,.45)" }}>
              <span className="font-display orbis-num text-[26px] font-extrabold">R$</span>
              <input
                ref={inputRef}
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter") confirmarValor(); }}
                placeholder="0,00"
                className="font-display orbis-num bg-transparent outline-none text-[26px] font-extrabold w-full"
              />
            </div>
            {sheet === "venda" && (
              <div className="mt-3 flex gap-2">
                {(["dinheiro", "pix", "cartao"] as MetodoVenda[]).map((m) => (
                  <button key={m} type="button" onClick={() => setMetodo(m)}
                    className="orbis-press flex-1 h-11 rounded-[13px] text-[14px] font-bold capitalize"
                    style={metodo === m
                      ? { background: "linear-gradient(180deg,#FFC63A,#F5B800)", color: "#1A1200", boxShadow: "0 4px 0 #B88700" }
                      : { background: "#1A1A1A", border: "1px solid rgba(255,255,255,.1)", color: "#B9B3A6" }}>
                    {m === "cartao" ? "Cartão" : m}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={confirmarValor} className="orbis-cta w-full mt-4">
              {sheet === "venda" ? "CONFIRMAR VENDA" : "REGISTRAR CALOTE"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
