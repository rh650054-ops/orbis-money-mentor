/* ============================================================
   CONCILIAÇÃO DO MERCADO PAGO (Rick, 08/09/2026)
   O vendedor lança as vendas à mão o dia inteiro. O Mercado Pago é a PROVA.
     • ConciliacaoDia → entra no fechamento do DEFCON: "você lançou X de Pix,
       caiu Y — faltam Z". Dinheiro é só o que ele contou.
     • ConciliacaoMes → entra na Finanças: quanto caiu no mês e quanto não caiu.
   Só aparece com a conta conectada; sem conexão vira o convite pra conectar.
   Todo hook acima do primeiro return.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Link2, Check, AlertTriangle, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const RED = "#F2465A";
const MP_AZUL = "#00B1EA";

interface Dia {
  conectado: boolean; data: string;
  pix_declarado: number; pix_caiu: number;
  cartao_declarado: number; cartao_caiu: number;
  dinheiro: number; gorjeta: number;
  total_declarado: number; total_caiu: number;
  nao_caiu: number; a_mais: number;
  vendas_nao_lancadas: number; ultima_sync_em: string | null;
}
interface Mes {
  conectado: boolean; mes: string;
  pix_declarado: number; pix_caiu: number;
  cartao_declarado: number; cartao_caiu: number;
  dinheiro: number;
  total_declarado: number; total_caiu: number; nao_caiu: number;
  dias_com_furo: number; pior_dia: string | null; pior_valor: number | null;
}

const num = (v: unknown) => Number(v) || 0;
const horaBR = (iso: string | null) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }); } catch { return ""; }
};
const diaBR = (iso: string | null) => {
  if (!iso) return "";
  try { return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); } catch { return iso; }
};

/** Convite curto (aparece quando ainda não conectou) */
function Convite({ texto }: { texto: string }) {
  const [indo, setIndo] = useState(false);
  const conectar = async () => {
    setIndo(true);
    const { data, error } = await (supabase as any).functions.invoke("mp-connect");
    setIndo(false);
    if (error || !data?.url) { toast({ title: "Não deu pra abrir o Mercado Pago", description: data?.dica || "Tenta de novo.", variant: "destructive" }); return; }
    window.location.href = data.url as string;
  };
  return (
    <div className="rounded-[18px] border p-3.5 flex items-center gap-3" style={{ background: "linear-gradient(160deg,#04212b,#0e0e10)", borderColor: `${MP_AZUL}55` }}>
      <span className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: `${MP_AZUL}1a`, border: `1px solid ${MP_AZUL}66` }}>
        <Link2 className="w-5 h-5" style={{ color: MP_AZUL }} strokeWidth={2.4} />
      </span>
      <p className="flex-1 min-w-0 text-[12.5px] leading-snug" style={{ color: "var(--orbis-fg-2)" }}>{texto}</p>
      <button type="button" onClick={conectar} disabled={indo} className="h-9 px-3 rounded-[11px] text-[11.5px] font-black shrink-0" style={{ background: MP_AZUL, color: "#03212b" }}>
        {indo ? <Loader2 className="w-4 h-4 animate-spin" /> : "CONECTAR"}
      </button>
    </div>
  );
}

function Linha({ nome, declarado, caiu, so }: { nome: string; declarado: number; caiu?: number; so?: string }) {
  const falta = caiu === undefined ? 0 : Math.max(0, declarado - caiu);
  const sobra = caiu === undefined ? 0 : Math.max(0, caiu - declarado);
  return (
    <div className="flex items-center gap-2.5 py-2.5" style={{ borderTop: "1px solid #22201a" }}>
      <p className="w-[86px] shrink-0 text-[12.5px] font-extrabold">{nome}</p>
      <p className="flex-1 min-w-0 text-[12px] tabular-nums" style={{ color: "var(--orbis-fg-2)" }}>
        {so ? so : <>lançou <b className="text-foreground">{formatCurrency(declarado)}</b> · caiu <b style={{ color: caiu && caiu > 0 ? OK : "var(--orbis-fg-3)" }}>{formatCurrency(caiu ?? 0)}</b></>}
      </p>
      {so ? null : falta > 0 ? (
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold tabular-nums" style={{ background: "#2a0c11", border: `1px solid ${RED}55`, color: "#ff7d8c" }}>faltam {formatCurrency(falta)}</span>
      ) : sobra > 0 ? (
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold tabular-nums" style={{ background: "#1a1305", border: "1px solid #3a2f0c", color: GOLD }}>+{formatCurrency(sobra)}</span>
      ) : (
        <Check className="w-4 h-4 shrink-0" style={{ color: OK }} strokeWidth={3} />
      )}
    </div>
  );
}

/** Fechamento do DEFCON: o que caiu de verdade hoje */
export function ConciliacaoDia({ userId, data }: { userId: string | undefined; data?: string }) {
  const [d, setD] = useState<Dia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  const ler = useCallback(async () => {
    const { data: r } = await (supabase as any).rpc("mp_conciliacao_dia", { p_data: data ?? null });
    const row = ((r as any[]) || [])[0];
    if (row) setD({
      ...row,
      pix_declarado: num(row.pix_declarado), pix_caiu: num(row.pix_caiu),
      cartao_declarado: num(row.cartao_declarado), cartao_caiu: num(row.cartao_caiu),
      dinheiro: num(row.dinheiro), gorjeta: num(row.gorjeta),
      total_declarado: num(row.total_declarado), total_caiu: num(row.total_caiu),
      nao_caiu: num(row.nao_caiu), a_mais: num(row.a_mais),
    } as Dia);
    setCarregando(false);
  }, [data]);

  // no fechamento a gente força uma conferida antes de mostrar o número
  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    (async () => {
      await ler();
      if (!vivo) return;
      setSincronizando(true);
      await (supabase as any).functions.invoke("mp-sync", { body: { dias: 1 } }).catch(() => {});
      if (!vivo) return;
      await ler();
      setSincronizando(false);
    })();
    return () => { vivo = false; };
  }, [userId, ler]);

  const atualizar = async () => {
    setSincronizando(true);
    await (supabase as any).functions.invoke("mp-sync", { body: { dias: 1 } }).catch(() => {});
    await ler();
    setSincronizando(false);
  };

  if (!userId || carregando) return null;
  if (!d?.conectado) {
    if (num(d?.total_declarado) <= 0) return null;
    return <Convite texto="Conecte o Mercado Pago e o Orbis confere quanto do seu Pix caiu de verdade — sem você digitar nada." />;
  }

  const digitalDeclarado = d.pix_declarado + d.cartao_declarado;
  const pct = digitalDeclarado > 0 ? Math.min(100, Math.round((d.total_caiu / digitalDeclarado) * 100)) : 100;

  return (
    <div className="rounded-[20px] border p-4" style={{ background: "#0e0e10", borderColor: d.nao_caiu > 0 ? `${RED}44` : `${OK}33` }}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black tracking-[.16em]" style={{ color: d.nao_caiu > 0 ? "#ff7d8c" : OK }}>O QUE CAIU DE VERDADE</p>
        <button type="button" onClick={atualizar} disabled={sincronizando} aria-label="Conferir de novo" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#16151a", border: "1px solid #2a2823", color: "var(--orbis-fg-3)" }}>
          {sincronizando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="mt-1">
        {(d.pix_declarado > 0 || d.pix_caiu > 0) && <Linha nome="Pix" declarado={d.pix_declarado} caiu={d.pix_caiu} />}
        {(d.cartao_declarado > 0 || d.cartao_caiu > 0) && <Linha nome="Maquininha" declarado={d.cartao_declarado} caiu={d.cartao_caiu} />}
        {d.dinheiro > 0 && <Linha nome="Dinheiro" declarado={d.dinheiro} so={`${formatCurrency(d.dinheiro)} — só você conta, o banco não vê`} />}
      </div>

      <div className="h-2 rounded-full overflow-hidden mt-2.5" style={{ background: "#2a1418" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg,#1f8f5c,${OK})` }} />
      </div>

      {d.nao_caiu > 0 ? (
        <div className="flex items-start gap-2.5 mt-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#ff7d8c" }} strokeWidth={2.4} />
          <p className="text-[12px] leading-snug" style={{ color: "var(--orbis-fg-2)" }}>
            <b style={{ color: "#ff7d8c" }}>{formatCurrency(d.nao_caiu)} ainda não caíram.</b> É Pix que o cliente disse que mandou. Pode cair ainda hoje — o Orbis fica conferindo sozinho. Se não cair, isso é calote e aparece no seu mês.
          </p>
        </div>
      ) : (
        <p className="text-[12px] mt-3" style={{ color: "var(--orbis-fg-2)" }}>
          Tudo que você lançou caiu na conta. {d.ultima_sync_em ? `Conferido às ${horaBR(d.ultima_sync_em)}.` : ""}
        </p>
      )}

      {d.a_mais > 0 && (
        <p className="text-[12px] mt-2 leading-snug" style={{ color: GOLD }}>
          Caiu {formatCurrency(d.a_mais)} a mais do que você lançou{d.vendas_nao_lancadas > 0 ? ` (${d.vendas_nao_lancadas} ${d.vendas_nao_lancadas === 1 ? "venda" : "vendas"})` : ""}. Confere na Finanças pra não perder venda no relatório.
        </p>
      )}
    </div>
  );
}

/** Finanças: o mês inteiro — o que caiu e o que nunca caiu */
export function ConciliacaoMes({ userId }: { userId: string | undefined }) {
  const [m, setM] = useState<Mes | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    (async () => {
      const { data } = await (supabase as any).rpc("mp_conciliacao_mes", { p_mes: null });
      const row = ((data as any[]) || [])[0];
      if (!vivo) return;
      if (row) setM({
        ...row,
        pix_declarado: num(row.pix_declarado), pix_caiu: num(row.pix_caiu),
        cartao_declarado: num(row.cartao_declarado), cartao_caiu: num(row.cartao_caiu),
        dinheiro: num(row.dinheiro), total_declarado: num(row.total_declarado),
        total_caiu: num(row.total_caiu), nao_caiu: num(row.nao_caiu),
        pior_valor: row.pior_valor == null ? null : num(row.pior_valor),
      } as Mes);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [userId]);

  if (!userId || carregando || !m?.conectado) return null;
  const digital = m.pix_declarado + m.cartao_declarado;
  const pct = digital > 0 ? Math.min(100, Math.round((m.total_caiu / digital) * 100)) : 100;

  return (
    <div className="rounded-[20px] border p-4" style={{ background: "#0e0e10", borderColor: "#22201a" }}>
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4" style={{ color: OK }} strokeWidth={2.6} />
        <p className="text-[10px] font-black tracking-[.16em]" style={{ color: OK }}>CAIU NA CONTA ESTE MÊS</p>
      </div>
      <p className="text-[26px] font-black tabular-nums leading-none mt-2" style={{ color: OK }}>{formatCurrency(m.total_caiu)}</p>
      <p className="text-[12px] mt-1" style={{ color: "var(--orbis-fg-2)" }}>
        de {formatCurrency(digital)} que você lançou em Pix e maquininha · <b style={{ color: pct >= 95 ? OK : "#ff7d8c" }}>{pct}%</b>
      </p>
      <div className="h-2.5 rounded-full overflow-hidden mt-2.5" style={{ background: "#2a1418" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg,#1f8f5c,${OK})` }} />
      </div>

      <div className="mt-1">
        <Linha nome="Pix" declarado={m.pix_declarado} caiu={m.pix_caiu} />
        {(m.cartao_declarado > 0 || m.cartao_caiu > 0) && <Linha nome="Maquininha" declarado={m.cartao_declarado} caiu={m.cartao_caiu} />}
        {m.dinheiro > 0 && <Linha nome="Dinheiro" declarado={m.dinheiro} so={`${formatCurrency(m.dinheiro)} — contado por você`} />}
      </div>

      {m.nao_caiu > 0 ? (
        <div className="rounded-[14px] p-3 mt-3" style={{ background: "linear-gradient(160deg,#1a0a0d,#0e0e10)", border: `1px solid ${RED}44` }}>
          <p className="text-[13px] font-extrabold" style={{ color: "#ff7d8c" }}>{formatCurrency(m.nao_caiu)} lançados que nunca caíram</p>
          <p className="text-[11.5px] mt-1 leading-snug" style={{ color: "var(--orbis-fg-2)" }}>
            Espalhados em {m.dias_com_furo} {m.dias_com_furo === 1 ? "dia" : "dias"}{m.pior_dia ? `, o pior foi ${diaBR(m.pior_dia)} (${formatCurrency(m.pior_valor ?? 0)})` : ""}. Isso é fiado ou calote — não é lucro. Cobra hoje: quanto mais tempo passa, menor a chance.
          </p>
        </div>
      ) : (
        <p className="text-[11.5px] mt-3" style={{ color: "var(--orbis-fg-3)" }}>Nenhum furo no mês: tudo que você lançou entrou na conta.</p>
      )}
    </div>
  );
}
