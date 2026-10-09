/* ============================================================
   FINANÇAS · A NOVA HOME (etapa 3 do Open Finance, v4 aprovada pelo Rick).
   Só aparece pra quem tem banco ligado. Abre respondendo "quanto você tem
   agora" (soma dos bancos), com o FÔLEGO: quantos dias ele aguenta sem vender
   pagando só as contas fixas (saldo ÷ contas fixas por dia), em quadradinhos.
   Embaixo: entrou / saiu / sobrou do mês, UM alerta (o mais urgente) e o que
   o Piloto Automático já organizou sozinho.
   Saldo negativo troca o card inteiro (1B): número vermelho + o que levou lá.
   Tudo vem de uma RPC só: financas_home().
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/shared/lib/utils";
import { avisar } from "@/shared/lib/avisar";
import { FinancasPainel } from "./FinancasPainel";
import { type ContaPapel } from "@/components/conectar/PapelContas";
import { puxarBancoAoAbrir } from "@/components/conectar/banco-pix";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const RED = "#ff8a7a";
const MUTE = "#7b766e";
const QUADRADOS = 14;

interface Alerta { tipo: "negativo" | "vencida" | "vence"; nome?: string; valor?: number; dia?: string; sobra?: number }
interface Causa { descricao: string; categoria: string; valor: number; data: string }
export interface HomeFinancas {
  tem_banco: boolean; tem_saldo: boolean; saldo: number | null;
  bancos: { banco: string | null; saldo: number }[]; atualizado: string | null;
  fixas_mes: number; folego_dias: number | null;
  entrou: number; saiu: number; sobrou: number;
  alerta: Alerta | null; causas: Causa[] | null;
  piloto: { lancamentos: number; conferir: number };
  // 04/10: conta de trabalho × pessoal (a reserva virou uma caixinha)
  saldo_trabalho?: number | null; saldo_pessoal?: number | null; saldo_reserva?: number | null;
  precisa_papel?: boolean; contas?: ContaPapel[];
}

const reais = (v: number) => formatCurrency(v).replace(/,00$/, "");
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const diaMes = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
};
const nomeMes = () => new Date().toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });

/** Fôlego em quadradinhos: cada um é um dia; o último cheio fica amarelo. */
export function Folego({ dias }: { dias: number }) {
  const cheios = Math.min(dias, QUADRADOS);
  return (
    <div className="flex gap-[3px] mt-2" aria-hidden>
      {Array.from({ length: QUADRADOS }, (_, i) => (
        <i key={i} className="flex-1 h-3.5 rounded-[3px]" style={{
          background: i < cheios - 1 || (i === cheios - 1 && dias > QUADRADOS)
            ? "linear-gradient(180deg,#5ee6a5,#1fa868)"
            : i === cheios - 1 ? "linear-gradient(180deg,#FFE27A,#F5B800)" : "#1c1c1b",
        }} />
      ))}
    </div>
  );
}

function Stat({ rotulo, valor, cor, sub }: { rotulo: string; valor: string; cor: string; sub: string }) {
  return (
    <div className="rounded-xl px-2.5 py-2 min-w-0" style={{ background: "#131312", border: "1px solid rgba(255,255,255,.07)" }}>
      <p className="text-[9px] font-black tracking-[.15em]" style={{ color: MUTE }}>{rotulo}</p>
      <p className="text-[16px] font-black tabular-nums mt-0.5 truncate" style={{ color: cor }}>{valor}</p>
      <p className="text-[9.5px] font-bold" style={{ color: MUTE }}>{sub}</p>
    </div>
  );
}

function AlertaCard({ a }: { a: Alerta }) {
  if (a.tipo === "negativo") return null;
  const titulo = a.tipo === "vencida"
    ? `${a.nome} venceu dia ${diaMes(a.dia ?? "")}: ${reais(a.valor ?? 0)}`
    : `${a.nome} vence dia ${diaMes(a.dia ?? "")}: ${reais(a.valor ?? 0)}`;
  const sub = a.tipo === "vencida"
    ? "Paga essa antes de qualquer outra."
    : (a.sobra ?? 0) >= 0
      ? `Com o saldo de hoje você paga e fica com ${reais(a.sobra ?? 0)}.`
      : `Faltam ${reais(Math.abs(a.sobra ?? 0))} no saldo pra pagar.`;
  return (
    <div className="rounded-2xl px-3 py-2.5 flex items-center gap-2.5"
      style={{ background: "linear-gradient(170deg,#1c0a08,#0e0e10 70%)", border: "1px solid rgba(255,90,69,.42)" }}>
      <span className="text-[18px]" aria-hidden>⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-black leading-tight" style={{ color: RED }}>{titulo}</p>
        <p className="text-[10.5px] font-bold mt-0.5" style={{ color: MUTE }}>{sub}</p>
      </div>
    </div>
  );
}

export function FinancasHomeView({ h, onPiloto }: { h: HomeFinancas; onPiloto: () => void }) {
  const saldo = h.saldo ?? 0;
  const negativo = h.tem_saldo && saldo < 0;
  const linhaBancos = h.bancos.map((b) => `${b.banco ?? "Banco"} ${reais(b.saldo)}`).join(" · ");
  const mes = nomeMes();

  return (
    <div className="space-y-2.5">
      {negativo ? (
        <div className="rounded-[18px] px-3.5 py-4 text-center"
          style={{ background: "linear-gradient(170deg,#1c0a08,#0e0e10 70%)", border: "1px solid rgba(255,90,69,.42)" }}>
          <p className="text-[10px] font-black tracking-[.15em]" style={{ color: RED }}>VOCÊ ESTÁ NO NEGATIVO</p>
          <p className="text-[34px] font-black tabular-nums leading-tight mt-1" style={{ color: RED }}>− {reais(Math.abs(saldo))}</p>
          <p className="text-[11.5px] mt-1" style={{ color: "#b9b3a6" }}>{linhaBancos}{h.atualizado ? ` · atualizado ${hora(h.atualizado)}` : ""}</p>
          {h.causas && h.causas.length > 0 && (
            <div className="text-left mt-3 rounded-xl px-3 py-1" style={{ background: "rgba(0,0,0,.35)" }}>
              <p className="text-[9.5px] font-black tracking-[.15em] pt-2" style={{ color: MUTE }}>O QUE MAIS SAIU NESSES 7 DIAS</p>
              {h.causas.map((c, i) => (
                <div key={i} className="flex items-center gap-2 py-2" style={{ borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,.07)" }}>
                  <span className="flex-1 min-w-0 text-[12.5px] font-extrabold truncate">{c.descricao}</span>
                  <span className="text-[10.5px] font-bold" style={{ color: MUTE }}>{diaMes(c.data)}</span>
                  <span className="text-[12.5px] font-black tabular-nums" style={{ color: RED }}>− {reais(c.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-[18px] px-3.5 py-4 text-center"
          style={{ background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)", border: "1px solid rgba(245,184,0,.42)" }}>
          <p className="text-[10px] font-black tracking-[.15em]" style={{ color: GOLD }}>QUANTO VOCÊ TEM AGORA</p>
          {h.tem_saldo ? (
            <>
              <p className="text-[36px] font-black tabular-nums leading-tight mt-1" style={{ color: GOLD }}>{reais(saldo)}</p>
              <p className="text-[11.5px] mt-1" style={{ color: "#b9b3a6" }}>{linhaBancos}{h.atualizado ? ` · atualizado ${hora(h.atualizado)}` : ""}</p>
              {h.saldo_pessoal != null && (
                <div className="grid grid-cols-2 gap-2 mt-3 text-left">
                  <div className="rounded-xl px-2.5 py-2" style={{ background: "rgba(245,184,0,.08)", border: "1px solid rgba(245,184,0,.25)" }}>
                    <p className="text-[9px] font-black tracking-[.14em]" style={{ color: GOLD }}>💼 FLUXO DE CAIXA</p>
                    <p className="text-[16px] font-black tabular-nums mt-0.5">{reais(h.saldo_trabalho ?? 0)}</p>
                  </div>
                  <div className="rounded-xl px-2.5 py-2" style={{ background: "rgba(90,176,255,.08)", border: "1px solid rgba(90,176,255,.3)" }}>
                    <p className="text-[9px] font-black tracking-[.14em]" style={{ color: "#5ab0ff" }}>🏠 PESSOAL</p>
                    <p className="text-[16px] font-black tabular-nums mt-0.5">{reais(h.saldo_pessoal ?? 0)}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-[12.5px] mt-2" style={{ color: "#b9b3a6" }}>Lendo o saldo do seu banco. Aparece aqui na próxima leitura.</p>
          )}
          <p className="text-[10px] font-black tracking-[.15em] mt-3.5" style={{ color: MUTE }}>FÔLEGO</p>
          {h.folego_dias != null ? (
            <>
              <Folego dias={h.folego_dias} />
              <p className="text-[11.5px] mt-1.5" style={{ color: "#b9b3a6" }}>
                <b style={{ color: "#F4F1EA" }}>{h.folego_dias > QUADRADOS ? `${QUADRADOS}+` : h.folego_dias} {h.folego_dias === 1 ? "dia" : "dias"}</b> sem vender, pagando só as contas fixas.
              </p>
            </>
          ) : (
            <p className="text-[11.5px] mt-1.5" style={{ color: "#b9b3a6" }}>
              {h.fixas_mes > 0 ? "Aparece quando o saldo for lido." : "Cadastre suas contas fixas (aluguel, luz, celular) pra ver quantos dias você aguenta."}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat rotulo="ENTROU" valor={reais(h.entrou)} cor={OK} sub={mes} />
        <Stat rotulo="SAIU" valor={reais(h.saiu)} cor={RED} sub={mes} />
        <Stat rotulo="SOBROU" valor={reais(h.sobrou)} cor={h.sobrou < 0 ? RED : GOLD}
          sub={h.entrou > 0 ? `${Math.round((h.sobrou / h.entrou) * 100)}%` : mes} />
      </div>

      {h.alerta && <AlertaCard a={h.alerta} />}

      <button type="button" onClick={onPiloto}
        className="w-full rounded-2xl px-3 py-2.5 flex items-center gap-2.5 text-left active:opacity-70"
        style={{ background: "#0f0f10", border: "1px solid rgba(255,255,255,.07)" }}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: OK, boxShadow: "0 0 0 4px rgba(61,214,140,.18)" }} />
        <span className="flex-1 min-w-0">
          <span className="block text-[12px] font-bold" style={{ color: "#b9b3a6" }}>
            {h.piloto.lancamentos} {h.piloto.lancamentos === 1 ? "gasto" : "gastos"} do banco em {mes}{h.piloto.conferir > 0 ? ` · ${h.piloto.conferir} pra conferir` : ""}
          </span>
        </span>
        <ChevronRight className="w-4 h-4 shrink-0" style={{ color: MUTE }} />
      </button>
    </div>
  );
}

/** Lê financas_home() uma vez; `recarregar` refaz (ex.: depois de escolher o papel das contas). */
export function useFinancasHome(userId?: string) {
  const [h, setH] = useState<HomeFinancas | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    (async () => {
      const { data, error } = await (supabase as unknown as { rpc: (f: string) => Promise<{ data: unknown; error: unknown }> }).rpc("financas_home");
      if (error) { avisar.silencioso("financas_home", error); return; }
      if (vivo) setH(data as HomeFinancas);
    })();
    return () => { vivo = false; };
  }, [userId, versao]);

  // 09/10 (Rick: "o saldo tem que atualizar quase automático"): abriu Finanças e o
  // banco foi lido há mais de 1 h → pede uma leitura agora e relê o saldo quando
  // a Pluggy responder (~20–60 s). O servidor respeita o limite do Open Finance.
  const pediuRef = useRef(false);
  useEffect(() => {
    if (!h?.tem_banco || pediuRef.current) return;
    const lido = h.atualizado ? Date.parse(h.atualizado) : 0;
    if (Date.now() - lido < 60 * 60_000) return;
    pediuRef.current = true;
    void puxarBancoAoAbrir();
    const t1 = setTimeout(() => setVersao((v) => v + 1), 25_000);
    const t2 = setTimeout(() => setVersao((v) => v + 1), 60_000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [h]);

  return { h, recarregar: () => setVersao((v) => v + 1) };
}

export function FinancasHome({ userId }: { userId?: string }) {
  const navigate = useNavigate();
  const { h } = useFinancasHome(userId);

  if (!h || !h.tem_banco) return null;
  return (
    <div className="space-y-2.5">
      <FinancasHomeView h={h} onPiloto={() => navigate("/financas/extrato")} />
      {/* etapa 4: cartão, dívidas e guardado, lidos do banco toda madrugada */}
      <FinancasPainel userId={userId} />
    </div>
  );
}
