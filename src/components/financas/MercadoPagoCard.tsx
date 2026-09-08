/* ============================================================
   CONECTAR MERCADO PAGO (Rick, 08/09/2026)
   O vendedor autoriza o Orbis na conta DELE do Mercado Pago; a partir daí o
   Orbis lê as vendas (Pix, maquininha Point, QR) sozinho — sem foto de extrato.
   Três estados:
     • desconectado → botão CONECTAR (abre a tela do MP)
     • conectado    → quanto entrou hoje + última atualização + desconectar
     • pendentes    → "o MP viu R$ X que você não lançou" → LANÇAR (1 toque)
   Não guarda nada sensível no app: o token mora no banco, fechado.
   Todo hook acima do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { Loader2, Link2, Check, RefreshCw, X, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const MP_AZUL = "#00B1EA";

interface Status { conectado: boolean; apelido: string | null; conectado_em: string | null; ultima_sync_em: string | null; recebido_hoje: number; vendas_hoje: number; pendentes: number; pendentes_valor: number; erro: string | null; provedores: string[] | null }

/** Carteiras que o vendedor pode ligar. Todas de graça, todas só leitura. */
const CARTEIRAS: { id: string; nome: string; fn: string; cor: string }[] = [
  { id: "mercadopago", nome: "Mercado Pago", fn: "mp-connect", cor: "#00B1EA" },
  { id: "pagbank", nome: "PagBank", fn: "pb-connect", cor: "#3DD68C" },
];
interface Pendente { payment_id: string; valor: number; metodo: string; origem: string; descricao: string | null; pago_em: string }

const horaBR = (iso: string | null) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }); } catch { return ""; }
};
const nomeMetodo = (m: string, o: string) =>
  o === "point" ? "maquininha" : m === "pix" ? "Pix" : m.includes("credit") ? "crédito" : m.includes("debit") ? "débito" : m || "recebido";

export function MercadoPagoCard({ userId, compacto = false }: { userId: string | undefined; compacto?: boolean }) {
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

  const conectar = async (c: { id: string; nome: string; fn: string }) => {
    setOcupado(c.id);
    const { data, error } = await (supabase as any).functions.invoke(c.fn);
    setOcupado(null);
    if (error || !data?.url) {
      toast({ title: `Não deu pra abrir o ${c.nome}`, description: data?.dica || "Tenta de novo em instantes.", variant: "destructive" });
      return;
    }
    window.location.href = data.url as string;
  };
  const atualizar = async () => {
    setOcupado("sync");
    await (supabase as any).functions.invoke("mp-sync", { body: { dias: 1 } });
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
  const ignorar = async (id: string) => {
    await (supabase as any).rpc("mp_ignorar_venda", { p_id: id });
    void carregar();
  };
  const desconectar = async () => {
    setOcupado("off");
    await (supabase as any).rpc("mp_desconectar", { p_provedor: null });
    setOcupado(null);
    toast({ title: "Mercado Pago desconectado" });
    void carregar();
  };

  if (!userId || carregando) return null;

  // ===== DESCONECTADO: convite =====
  if (!st?.conectado) {
    if (compacto) return null;
    return (
      <div className="rounded-[20px] border p-4" style={{ background: "linear-gradient(160deg,#04212b,#0e0e10)", borderColor: `${MP_AZUL}55` }}>
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0" style={{ background: `${MP_AZUL}1a`, border: `1px solid ${MP_AZUL}66` }}>
            <Link2 className="w-5 h-5" style={{ color: MP_AZUL }} strokeWidth={2.4} />
          </span>
          <div className="min-w-0">
            <p className="text-[14.5px] font-black leading-tight">Conecte onde você recebe</p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-2)" }}>O Orbis confere sozinho o que caiu de Pix e maquininha — e mostra o que não caiu.</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {CARTEIRAS.map((c) => (
            <button key={c.id} type="button" onClick={() => conectar(c)} disabled={!!ocupado}
              className="flex-1 h-11 rounded-[13px] inline-flex items-center justify-center gap-2 text-[13px] font-black active:scale-[0.98] transition-transform disabled:opacity-60"
              style={{ background: c.cor, color: "#03212b" }}>
              {ocupado === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" strokeWidth={2.6} />} {c.nome}
            </button>
          ))}
        </div>
        <p className="text-[11px] mt-2 leading-snug" style={{ color: "var(--orbis-fg-3)" }}>
          Você autoriza dentro da própria carteira. O Orbis só <b>lê</b> o que entrou — não move dinheiro, não pega senha, e você desliga quando quiser.
        </p>
      </div>
    );
  }

  // ===== CONECTADO =====
  return (
    <div className="rounded-[20px] border p-4" style={{ background: "#0e0e10", borderColor: st.pendentes > 0 ? `${GOLD}55` : "#22201a" }}>
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: `${OK}1a`, border: `1px solid ${OK}55` }}>
          <Check className="w-5 h-5" style={{ color: OK }} strokeWidth={3} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black tracking-[.14em] truncate" style={{ color: OK }}>{(st.provedores ?? []).map((p) => (CARTEIRAS.find((c) => c.id === p)?.nome ?? p).toUpperCase()).join(" · ")} CONECTADO</p>
          <p className="text-[15px] font-black leading-tight mt-0.5 tabular-nums">{formatCurrency(st.recebido_hoje)} <span className="text-[12px] font-bold" style={{ color: "var(--orbis-fg-2)" }}>entraram hoje{st.vendas_hoje > 0 ? ` · ${st.vendas_hoje} ${st.vendas_hoje === 1 ? "venda" : "vendas"}` : ""}</span></p>
        </div>
        <button type="button" onClick={atualizar} disabled={ocupado === "sync"} aria-label="Atualizar" className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "#16151a", border: "1px solid #2a2823", color: "var(--orbis-fg-2)" }}>
          {ocupado === "sync" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>

      {st.pendentes > 0 && (
        <>
          <p className="text-[12.5px] font-extrabold mt-3" style={{ color: GOLD }}>
            O Mercado Pago viu {formatCurrency(st.pendentes_valor)} que você ainda não lançou.
          </p>
          <div className="mt-2">
            {pend.slice(0, 5).map((p) => (
              <div key={p.payment_id} className="flex items-center gap-2.5 py-2" style={{ borderTop: "1px solid #22201a" }}>
                <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold tabular-nums shrink-0" style={{ background: `${OK}1a`, border: `1px solid ${OK}55`, color: OK }}>{formatCurrency(p.valor)}</span>
                <p className="flex-1 min-w-0 text-[12px] truncate" style={{ color: "var(--orbis-fg-2)" }}>{nomeMetodo(p.metodo, p.origem)} · {horaBR(p.pago_em)}</p>
                <button type="button" onClick={() => lancar([p.payment_id])} disabled={!!ocupado} className="h-8 px-3 rounded-[10px] text-[11.5px] font-black shrink-0" style={{ background: GOLD, color: "#1a1305" }}>LANÇAR</button>
                <button type="button" onClick={() => ignorar(p.payment_id)} aria-label="Não é venda" className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "#16151a", border: "1px solid #2a2823", color: "var(--orbis-fg-3)" }}><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          {pend.length > 1 && (
            <button type="button" onClick={() => lancar(pend.map((p) => p.payment_id))} disabled={!!ocupado}
              className="w-full h-11 rounded-[13px] mt-2 inline-flex items-center justify-center gap-2 text-[13px] font-black active:scale-[0.98] transition-transform disabled:opacity-60"
              style={{ background: GOLD, color: "#1a1305" }}>
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={3} />} LANÇAR AS {pend.length} DE UMA VEZ
            </button>
          )}
        </>
      )}

      {st.pendentes === 0 && (
        <p className="text-[11.5px] mt-2.5" style={{ color: "var(--orbis-fg-3)" }}>
          Tudo lançado. {st.ultima_sync_em ? `Última conferida às ${horaBR(st.ultima_sync_em)}.` : "Conferindo a cada 5 minutos."}
          {st.apelido ? ` Conta: ${st.apelido}.` : ""}
        </p>
      )}
      {st.erro && <p className="text-[11.5px] mt-2" style={{ color: "#ff7d8c" }}>A conexão precisa ser refeita — toque em conectar de novo.</p>}

      {!compacto && CARTEIRAS.filter((c) => !(st.provedores ?? []).includes(c.id)).map((c) => (
        <button key={c.id} type="button" onClick={() => conectar(c)} disabled={!!ocupado}
          className="w-full h-10 rounded-[12px] mt-2.5 inline-flex items-center justify-center gap-2 text-[12.5px] font-black"
          style={{ background: "#16151a", border: `1px solid ${c.cor}55`, color: c.cor }}>
          {ocupado === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" strokeWidth={2.6} />} Ligar também o {c.nome}
        </button>
      ))}

      {!compacto && (
        <button type="button" onClick={desconectar} disabled={ocupado === "off"} className="mt-3 text-[11.5px] font-bold inline-flex items-center gap-1.5" style={{ color: "var(--orbis-fg-3)" }}>
          <Unlink className="w-3.5 h-3.5" /> Desconectar tudo
        </button>
      )}
    </div>
  );
}
