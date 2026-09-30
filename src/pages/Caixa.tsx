/* ============================================================
   CAIXA DA VANT (Rick, 30/09/2026) — /caixa

   Painel financeiro dos sócios, fora do app (sem menu, sem layout do vendedor).
   Só Rick e Mohamed entram: login com o CPF da conta do app e o banco confere
   caixa_socios (RLS). O saldo começa no saldo da Hotmart de 30/09, cada venda
   aprovada entra sozinha, e tudo que mexe no caixa fica no extrato + histórico.
   ============================================================ */
import { useEffect, useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import "@/styles/caixa.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCaixa, type CaixaLancamento } from "@/hooks/useCaixa";
import CaixaLogin from "@/components/caixa/CaixaLogin";
import CaixaGeral from "@/components/caixa/CaixaGeral";
import CaixaExtrato from "@/components/caixa/CaixaExtrato";
import CaixaInfluenciadores from "@/components/caixa/CaixaInfluenciadores";
import CaixaIA from "@/components/caixa/CaixaIA";
import CaixaProjecao from "@/components/caixa/CaixaProjecao";
import CaixaLancar from "@/components/caixa/CaixaLancar";
import CaixaSaldo from "@/components/caixa/CaixaSaldo";
import { VantLogo } from "@/components/caixa/caixa-ui";
import { mesNome, hojeBR } from "@/components/caixa/caixa-fmt";

type Aba = "geral" | "extrato" | "inf" | "ia" | "proj";
const ABAS: [Aba, string][] = [["geral", "Visão geral"], ["extrato", "Extrato"], ["inf", "Influenciadores & contas"], ["ia", "IA"], ["proj", "Projeção"]];

export default function Caixa() {
  const { user, loading: authLoading } = useAuth();
  const [socio, setSocio] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setSocio(null); return; }
    let vivo = true;
    (supabase as any).rpc("caixa_eh_socio").then((r: { data: boolean | null }) => { if (vivo) setSocio(r.data === true); });
    return () => { vivo = false; };
  }, [user]);

  const sair = () => { void supabase.auth.signOut(); };

  if (authLoading || (user && socio === null)) {
    return <div className="cx"><div className="cx-login"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#FFC800" }} /></div></div>;
  }
  if (!user) return <div className="cx"><CaixaLogin /></div>;
  if (!socio) return <div className="cx"><CaixaLogin semAcesso onSair={sair} /></div>;
  return <PainelCaixa userId={user.id} onSair={sair} />;
}

function PainelCaixa({ userId, onSair }: { userId: string; onSair: () => void }) {
  const [aba, setAba] = useState<Aba>(() => {
    const h = window.location.hash.replace("#", "");
    return (ABAS.some(([k]) => k === h) ? h : "geral") as Aba;
  });
  const [mes, setMes] = useState(`${hojeBR().slice(0, 7)}-01`);
  const [catExtrato, setCatExtrato] = useState<string | null>(null);
  const [lancar, setLancar] = useState<null | { tipo: "saida" | "entrada"; editando?: CaixaLancamento }>(null);
  const [saldoAberto, setSaldoAberto] = useState(false);
  const cx = useCaixa(userId, mes);
  const r = cx.resumo;
  const cambio = Number(r?.config.cambio_usd) > 0 ? Number(r?.config.cambio_usd) : 5.5;
  const cfg = (r?.config ?? {}) as Record<string, unknown>;

  useEffect(() => { window.history.replaceState(null, "", `#${aba}`); }, [aba]);

  // Consumo das APIs: atualiza sozinho ao abrir, no máximo 1x por hora.
  const iaQuando = (cfg.ia_sync as { quando?: string } | undefined)?.quando;
  useEffect(() => {
    if (!r) return;
    if (!iaQuando || Date.now() - new Date(iaQuando).getTime() > 3600_000) void cx.sincronizar("ia");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(r)]);

  const ir = (dest: string) => {
    if (dest.startsWith("extrato:")) { setCatExtrato(dest.slice(8)); setAba("extrato"); }
    else setAba(dest as Aba);
    window.scrollTo({ top: 0 });
  };
  const mudaMes = (delta: number) => {
    const d = new Date(`${mes}T12:00:00`); d.setMonth(d.getMonth() + delta);
    const novo = d.toISOString().slice(0, 7) + "-01";
    if (novo <= `${hojeBR().slice(0, 7)}-01`) setMes(novo);
  };
  const consumoIaMesUsd = cx.lancamentos.filter((l) => !l.afeta_saldo && l.categoria === "ia" && l.data.startsWith(hojeBR().slice(0, 7)))
    .reduce((a, l) => a + Math.abs(Number(l.valor_original) || 0), 0);

  return (
    <div className="cx">
      <div className="cx-wrap">
        <div className="cx-top">
          <div className="cx-logo"><VantLogo /><div><b>CAIXA DA VANT</b><br /><span>painel dos sócios · {Object.values(cx.socios).join(" e ") || "Rick e Mohamed"}</span></div></div>
          <div className="cx-acts">
            <span className="cx-pill">
              <button type="button" onClick={() => mudaMes(-1)} aria-label="Mês anterior" style={{ background: "none", border: 0, color: "inherit", cursor: "pointer", font: "inherit" }}>‹</button>
              {mesNome(mes)}
              <button type="button" onClick={() => mudaMes(1)} aria-label="Próximo mês" style={{ background: "none", border: 0, color: "inherit", cursor: "pointer", font: "inherit" }}>›</button>
            </span>
            <button type="button" className="cx-btn" onClick={() => setSaldoAberto(true)}>saldo</button>
            <button type="button" className="cx-btn" onClick={() => setLancar({ tipo: "entrada" })}>＋ entrada</button>
            <button type="button" className="cx-btn gold" onClick={() => setLancar({ tipo: "saida" })}>＋ lançar gasto</button>
            <button type="button" className="cx-btn sm" onClick={onSair} aria-label="Sair"><LogOut className="w-3.5 h-3.5 inline" /></button>
          </div>
        </div>

        <div className="cx-tabs" role="tablist">
          {ABAS.map(([k, rot]) => <button type="button" role="tab" key={k} aria-selected={aba === k} onClick={() => setAba(k)}>{rot}</button>)}
        </div>

        {cx.erro && <p className="cx-erro">{cx.erro}</p>}
        {!r ? (
          <div className="cx-grid cx-g5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="cx-card" style={{ height: 112, opacity: 0.5 }} />)}</div>
        ) : aba === "geral" ? (
          <CaixaGeral resumo={r} onSync={cx.sincronizar} onIr={ir} />
        ) : aba === "extrato" ? (
          <CaixaExtrato lancamentos={cx.lancamentos} auditoria={cx.auditoria} socios={cx.socios} categoria={catExtrato}
            onLimparCategoria={() => setCatExtrato(null)}
            onEditar={(l) => setLancar({ tipo: l.valor > 0 ? "entrada" : "saida", editando: l })}
            onMarcarPago={(l) => void cx.editarLancamento(l.id, { status: "pago", data: hojeBR() })}
            onApagar={(l) => cx.apagarLancamento(l.id)}
            onVerComprovante={async (p) => { const u = await cx.linkComprovante(p); if (u) window.open(u, "_blank", "noopener"); }} />
        ) : aba === "inf" ? (
          <CaixaInfluenciadores influenciadores={r.influenciadores} recorrentes={cx.recorrentes}
            onSalvarInf={cx.salvarInfluenciador} onPagar={cx.pagarInfluenciador} onSalvarRec={cx.salvarRecorrente} />
        ) : aba === "ia" ? (
          <CaixaIA lancamentos={cx.lancamentos} config={cfg} cambio={cambio} onSync={() => cx.sincronizar("ia")} onSalvarConfig={cx.salvarConfig} />
        ) : (
          <CaixaProjecao saldo={r.saldo} vendas={cx.vendas} recorrentes={cx.recorrentes} influenciadores={r.influenciadores}
            mediaDia30={r.media_dia_30} consumoIaMesUsd={consumoIaMesUsd} cambio={cambio} />
        )}
      </div>

      {lancar && (
        <CaixaLancar cambio={cambio} inicial={lancar.tipo} editando={lancar.editando ?? null} onClose={() => setLancar(null)}
          onSalvar={cx.lancar} onEditar={cx.editarLancamento} subirComprovante={cx.subirComprovante} />
      )}
      {saldoAberto && r && (
        <CaixaSaldo saldo={r.saldo}
          hotmart={{ disponivel: cfg.hotmart_disponivel != null ? Number(cfg.hotmart_disponivel) : null, receber: cfg.hotmart_a_receber != null ? Number(cfg.hotmart_a_receber) : null }}
          onClose={() => setSaldoAberto(false)} onLancar={cx.lancar} onCorrigir={cx.ajustarSaldo} onHotmart={cx.syncHotmart} />
      )}
    </div>
  );
}
