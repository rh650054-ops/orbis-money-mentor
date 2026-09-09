/* ============================================================
   CARD DE CONEXÃO NA FINANÇAS (Rick, 09/09/2026)
   Não pede pra conectar: oferece o PRÊMIO. Toca e vai pra /verificar,
   onde ele vê os benefícios ANTES de qualquer banco.
   Três estados:
     • desconectado → convite azul "VER O QUE EU GANHO"
     • conectado    → quanto caiu hoje + selo + pendentes pra lançar
     • compacto     → só a lista de pendentes (usado no fechamento do DEFCON)
   Todo hook acima do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Check, RefreshCw, X, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";
import { Selo, Raios, LogoCarteira, CARTEIRAS } from "@/components/conectar/Selo";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const CIANO = "#7FD3FF";

interface Status { conectado: boolean; apelido: string | null; ultima_sync_em: string | null; recebido_hoje: number; vendas_hoje: number; pendentes: number; pendentes_valor: number; erro: string | null; provedores: string[]; verificado: boolean }
interface Pendente { payment_id: string; valor: number; metodo: string; origem: string; pago_em: string }

const horaBR = (iso: string | null) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }); } catch { return ""; }
};
const nomeMetodo = (m: string, o: string) =>
  o === "point" ? "maquininha" : m === "pix" ? "Pix" : m.includes("credit") ? "crédito" : m.includes("debit") ? "débito" : m || "recebido";

export function MercadoPagoCard({ userId, compacto = false }: { userId: string | undefined; compacto?: boolean }) {
  const navigate = useNavigate();
  const [st, setSt] = useState<Status | null>(null);
  const [pend, setPend] = useState<Pendente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!userId) return;
    const { data } = await (supabase as any).rpc("mp_status");
    const s = ((data as any[]) || [])[0];
    const status: Status | null = s ? { ...s, recebido_hoje: Number(s.recebido_hoje) || 0, pendentes_valor: Number(s.pendentes_valor) || 0, provedores: (s.provedores as string[] | null) ?? [] } : null;
    setSt(status);
    if (status?.pendentes) {
      const { data: p } = await (supabase as any).rpc("mp_vendas_pendentes", { p_dias: 1 });
      setPend(((p as any[]) || []).map((x) => ({ ...x, valor: Number(x.valor) || 0 })) as Pendente[]);
    } else setPend([]);
    setCarregando(false);
  }, [userId]);
  useEffect(() => { void carregar(); }, [carregar]);

  const atualizar = async () => {
    setOcupado("sync");
    await (supabase as any).functions.invoke("mp-sync", { body: { dias: 1 } }).catch(() => {});
    await carregar();
    setOcupado(null);
  };
  const lancar = async (ids: string[]) => {
    setOcupado(ids.join(","));
    const { data, error } = await (supabase as any).rpc("mp_lancar_vendas", { p_ids: ids });
    setOcupado(null);
    if (error) { toast({ title: "Não rolou", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${Number(data) || 0} ${Number(data) === 1 ? "venda lançada" : "vendas lançadas"}`, description: "Já entrou no seu dia." });
    void carregar();
  };
  const ignorar = async (id: string) => { await (supabase as any).rpc("mp_ignorar_venda", { p_id: id }); void carregar(); };

  if (!userId || carregando) return null;

  // ===== CONVITE (não conectado) =====
  if (!st?.conectado) {
    if (compacto) return null;
    return (
      <button type="button" onClick={() => navigate("/verificar")}
        className="w-full text-left relative overflow-hidden rounded-[24px] p-[18px] active:scale-[0.99] transition-transform"
        style={{ background: "radial-gradient(120% 80% at 50% -10%,#123f5e 0%,#0a2033 38%,#08090b 78%)", border: "1px solid rgba(63,169,255,.26)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.07), 0 24px 60px -34px rgba(63,169,255,.5)" }}>
        <Raios />
        <div className="relative flex items-center gap-3.5">
          <Selo size={64} />
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-[.2em]" style={{ color: CIANO }}>SELO VERIFICADO</p>
            <p className="text-[19px] font-black tracking-[-.03em] leading-[1.15] mt-1">Prove que<br />você vende</p>
          </div>
        </div>
        <p className="relative text-[12.5px] mt-3.5 leading-relaxed" style={{ color: "#a9a49c" }}>
          Ligue onde você recebe e ganhe o selo azul, entre nas competições valendo dinheiro e descubra quem não te pagou.
        </p>
        <div className="relative flex items-center gap-1.5 mt-3.5">
          {CARTEIRAS.slice(0, 2).map((c) => <LogoCarteira key={c.id} sigla={c.sigla} fundo={c.fundo} cor={c.cor} size={30} />)}
          <span className="inline-flex items-center justify-center shrink-0 font-black" style={{ width: 30, height: 30, borderRadius: 10, background: "#131316", border: "1px dashed #2c2c31", color: "#7b766e", fontSize: 9 }}>+3</span>
          <span className="text-[11.5px] ml-1" style={{ color: "#7b766e" }}>grátis · 30 segundos</span>
        </div>
        <span className="relative flex items-center justify-center gap-2 w-full h-[52px] rounded-[16px] mt-3.5 text-[14px] font-black"
          style={{ background: "linear-gradient(180deg,#63BBFF,#2F9BFF 55%,#1C7FE0)", color: "#04203a", boxShadow: "0 1px 0 rgba(255,255,255,.4) inset, 0 5px 0 #14548f, 0 16px 34px rgba(47,155,255,.25)" }}>
          VER O QUE EU GANHO <ChevronRight className="w-4 h-4" strokeWidth={3} />
        </span>
      </button>
    );
  }

  // ===== CONECTADO =====
  const nomes = st.provedores.map((p) => CARTEIRAS.find((c) => c.id === p)?.nome ?? p).join(" · ");
  return (
    <div className="rounded-[20px] border p-[15px]" style={{ background: "linear-gradient(180deg,#101013,#0b0b0d)", borderColor: st.pendentes > 0 ? "rgba(245,184,0,.35)" : "#1e1d21", boxShadow: "inset 0 1px 0 rgba(255,255,255,.045)" }}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate("/verificar")} className="shrink-0"><Selo size={40} /></button>
        <div className="flex-1 min-w-0">
          <p className="text-[9.5px] font-black tracking-[.18em] truncate" style={{ color: CIANO }}>VERIFICADO · {nomes.toUpperCase()}</p>
          <p className="text-[15px] font-black leading-tight mt-0.5 tabular-nums">
            {formatCurrency(st.recebido_hoje)} <span className="text-[12px] font-bold" style={{ color: "#a9a49c" }}>caiu hoje{st.vendas_hoje > 0 ? ` · ${st.vendas_hoje} ${st.vendas_hoje === 1 ? "venda" : "vendas"}` : ""}</span>
          </p>
        </div>
        <button type="button" onClick={atualizar} disabled={ocupado === "sync"} aria-label="Conferir de novo" className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "#131316", border: "1px solid #232327", color: "#7b766e" }}>
          {ocupado === "sync" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>

      {st.pendentes > 0 && (
        <>
          <p className="text-[12.5px] font-extrabold mt-3" style={{ color: GOLD }}>Entraram {formatCurrency(st.pendentes_valor)} que você ainda não lançou.</p>
          <div className="mt-1.5">
            {pend.slice(0, 5).map((p) => (
              <div key={p.payment_id} className="flex items-center gap-2.5 py-2" style={{ borderTop: "1px solid #1e1d21" }}>
                <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold tabular-nums shrink-0" style={{ background: "rgba(61,214,140,.08)", border: "1px solid rgba(61,214,140,.35)", color: OK }}>{formatCurrency(p.valor)}</span>
                <p className="flex-1 min-w-0 text-[12px] truncate" style={{ color: "#a9a49c" }}>{nomeMetodo(p.metodo, p.origem)} · {horaBR(p.pago_em)}</p>
                <button type="button" onClick={() => lancar([p.payment_id])} disabled={!!ocupado} className="h-8 px-3 rounded-[10px] text-[11.5px] font-black shrink-0" style={{ background: GOLD, color: "#1a1305" }}>LANÇAR</button>
                <button type="button" onClick={() => ignorar(p.payment_id)} aria-label="Não é venda" className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "#131316", border: "1px solid #232327", color: "#7b766e" }}><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          {pend.length > 1 && (
            <button type="button" onClick={() => lancar(pend.map((p) => p.payment_id))} disabled={!!ocupado} className="w-full h-11 rounded-[13px] mt-2 inline-flex items-center justify-center gap-2 text-[13px] font-black" style={{ background: GOLD, color: "#1a1305" }}>
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={3} />} LANÇAR AS {pend.length} DE UMA VEZ
            </button>
          )}
        </>
      )}

      {st.pendentes === 0 && !compacto && (
        <p className="text-[11.5px] mt-2.5" style={{ color: "#7b766e" }}>
          Tudo lançado. {st.ultima_sync_em ? `Conferido às ${horaBR(st.ultima_sync_em)}.` : "Conferindo a cada 5 minutos."}
          {st.provedores.length < 2 ? " Ligue outra carteira pra comprovar ainda mais." : ""}
        </p>
      )}
      {st.erro && <p className="text-[11.5px] mt-2" style={{ color: "#ff8a97" }}>A conexão precisa ser refeita — toque no selo.</p>}
    </div>
  );
}
