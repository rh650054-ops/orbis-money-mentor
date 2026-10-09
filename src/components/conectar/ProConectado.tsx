/* ============================================================
   VANT PRO · CONECTADO — a tela de quem já é Pro e ligou banco (03/10/2026).
   Segue o mockup "3 · Depois de conectar (a recompensa)" (Claude outputs/mock-conectar.png):
     1) Você é um vendedor VERIFICADO (escudo azul + selos)
     2) COMPROVADO HOJE: o que caiu na conta × o que você lançou
     3) Onde você recebe: os bancos ligados pelo Open Finance (ATIVO)
     4) Gerenciar conexões: desconectar banco
   Os números vêm de vant_pro_hoje() (mesma regra do relatório: o dia é o do
   último DEFCON, hoje ou ontem).
   ============================================================ */
import { useEffect, useState } from "react";
import { Loader2, Plus, Landmark, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { formatCurrency } from "@/shared/lib/utils";
import { SeloVerificado } from "@/components/ranking/AvatarRanking";
import { saudeDoBanco, horaBR, type BancoLigado } from "@/components/conectar/pluggy";

const OK = "#3DD68C";
const RED = "#ff6b7a";
const GOLD = "#F5B800";
const MUTE = "#8a857c";
const LINHA = "#1f1e22";

const reais = (v: number) => formatCurrency(v).replace(/,00$/, "");
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export interface ProHoje { dia: string; hoje: boolean; caiu: number; qtd: number; lancou: number; ultima_leitura: string | null }

export async function carregarProHoje(): Promise<ProHoje | null> {
  const { data, error } = await (supabase as unknown as { rpc: (f: string) => Promise<{ data: unknown; error: unknown }> }).rpc("vant_pro_hoje");
  if (error) { avisar.silencioso("vant_pro_hoje", error); return null; }
  const r = data as Partial<ProHoje> | null;
  if (!r?.dia) return null;
  return {
    dia: String(r.dia), hoje: !!r.hoje, caiu: Number(r.caiu) || 0, qtd: Number(r.qtd) || 0,
    lancou: Number(r.lancou) || 0, ultima_leitura: r.ultima_leitura ?? null,
  };
}

const caixa = { background: "linear-gradient(180deg,#111114,#0b0b0d)", border: `1px solid ${LINHA}` };

/* ---------- 1 · selo (discreto, 09/10) ----------
   Era um herói enorme ("Você é um vendedor VERIFICADO" com escudo de 84px).
   Mohamed (09/10): "deixa algo sutil, o verificadinho do lado". Virou uma linha. */
export function HeroVerificado({ nome, verificado, desde }: { nome: string; verificado: boolean; desde: string | null }) {
  return (
    <div className="flex items-center gap-2 px-1 min-w-0">
      <span className="text-[15px] font-extrabold truncate">{nome}</span>
      {verificado && <SeloVerificado size={15} />}
      <span className="text-[11.5px] font-semibold shrink-0" style={{ color: verificado ? "#8cc2ff" : MUTE }}>
        {verificado ? "verificado" : "banco ligado"}{desde ? ` · desde ${desde}` : ""}
      </span>
    </div>
  );
}

/* ---------- 2 · comprovado hoje ---------- */
export function ComprovadoHoje({ h }: { h: ProHoje | null }) {
  const caiu = h?.caiu ?? 0;
  const lancou = h?.lancou ?? 0;
  const falta = Math.max(0, Math.round((lancou - caiu) * 100) / 100);
  const pct = lancou > 0 ? Math.min(100, (caiu / lancou) * 100) : caiu > 0 ? 100 : 0;
  const titulo = !h || h.hoje ? "COMPROVADO HOJE" : `COMPROVADO ${ddmm(h.dia)}`;
  return (
    <div className="rounded-[22px] px-4 py-4" style={caixa}>
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-black tracking-[.16em]" style={{ color: OK }}>{titulo}</p>
      </div>
      <div className="flex items-end justify-between mt-2.5 gap-3">
        <div className="min-w-0">
          <p className="text-[34px] font-black tabular-nums leading-none" style={{ color: OK }}>{reais(caiu)}</p>
          <p className="text-[11.5px] mt-1.5" style={{ color: MUTE }}>caiu na conta{h && h.qtd > 0 ? ` · ${h.qtd} Pix` : ""}</p>
        </div>
        {lancou > 0 && (
          <div className="text-right shrink-0">
            <p className="text-[22px] font-black tabular-nums leading-none">{reais(lancou)}</p>
            <p className="text-[11.5px] mt-1.5" style={{ color: MUTE }}>você lançou</p>
          </div>
        )}
      </div>
      <div className="h-[7px] rounded-full mt-3.5 overflow-hidden" style={{ background: "#1c1c1f" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#1fa868,#5ee6a5)" }} />
      </div>
      <p className="text-[12px] mt-2.5 leading-relaxed" style={{ color: MUTE }}>
        {lancou === 0
          ? "Lance suas vendas no DEFCON e a Vant compara com o que caiu."
          : falta > 0
            ? <><b style={{ color: RED }}>{reais(falta)} ainda não caíram.</b> {h?.hoje ? "Pode cair hoje — a Vant confere a cada 15 min." : "Confira no relatório do dia."}</>
            : caiu - lancou >= 1
              ? <><b style={{ color: GOLD }}>Caiu {reais(caiu - lancou)} a mais do que você lançou.</b> Esqueceu de lançar alguma venda? Confira no relatório.</>
              : <b style={{ color: OK }}>Tudo que você lançou caiu na conta.</b>}
      </p>
      {h?.ultima_leitura && <p className="text-[10.5px] font-bold mt-1.5" style={{ color: "#5d5952" }}>lido às {horaBR(h.ultima_leitura)}</p>}
    </div>
  );
}

/* ---------- 3 · onde você recebe ---------- */
function Logo({ b }: { b: BancoLigado }) {
  return b.institution_logo
    ? <img src={b.institution_logo} alt="" className="w-[46px] h-[46px] rounded-[14px] shrink-0 object-contain p-1.5" style={{ background: "#fff" }} />
    : <span className="w-[46px] h-[46px] rounded-[14px] shrink-0 flex items-center justify-center" style={{ background: "#16151a", border: "1px solid #2a2823" }}><Landmark className="w-5 h-5" style={{ color: MUTE }} /></span>;
}

const pilula = (cor: string, borda: string) =>
  ({ color: cor, border: `1.5px solid ${borda}`, background: "transparent" }) as React.CSSProperties;

export function OndeRecebe({ bancos, ligando, onLigarBanco, onAutorizar }: {
  bancos: BancoLigado[]; ligando: boolean;
  onLigarBanco: () => void;
  /** banco esperando o vendedor aprovar no app do banco → abre a Pluggy no mesmo item */
  onAutorizar?: (b: BancoLigado) => void;
}) {
  return (
    <div className="rounded-[22px] px-4 py-1" style={caixa}>
      {bancos.map((b, i) => {
        const s = saudeDoBanco(b.status, b.last_synced_at);
        return (
          <div key={b.id} className="flex items-center gap-3 py-3.5" style={{ borderTop: i === 0 ? "none" : `1px solid ${LINHA}` }}>
            <Logo b={b} />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-black truncate">{b.institution_name || "Banco"}</p>
              <p className="text-[11.5px] truncate" style={{ color: s.alerta ? s.cor : MUTE }}>
                {s.alerta ? s.texto : `${b.papel === "pessoal" ? "pessoal" : b.papel === "trabalho" ? "trabalho · vira venda" : "banco"} · conferido ${horaBR(b.last_synced_at)}`}
              </p>
            </div>
            {"autorizar" in s && s.autorizar && onAutorizar
              ? <button type="button" onClick={() => onAutorizar(b)} disabled={ligando}
                  className="shrink-0 rounded-full px-3 py-[6px] text-[11px] font-black active:opacity-70 disabled:opacity-50"
                  style={{ background: GOLD, color: "#141005" }}>AUTORIZAR</button>
              : s.alerta
              ? <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: s.cor }} />
              : <span className="shrink-0 rounded-full px-3 py-[5px] text-[11px] font-black" style={pilula(OK, "rgba(61,214,140,.55)")}>ATIVO</span>}
          </div>
        );
      })}
      <button type="button" onClick={onLigarBanco} disabled={ligando}
        className="w-full flex items-center gap-3 py-3.5 text-left" style={{ borderTop: `1px solid ${LINHA}` }}>
        <span className="w-[46px] h-[46px] rounded-[14px] shrink-0 flex items-center justify-center" style={{ border: "1.5px dashed #3a3832" }}>
          {ligando ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: GOLD }} /> : <Plus className="w-5 h-5" style={{ color: GOLD }} strokeWidth={2.6} />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-black">Ligar outro banco</span>
          <span className="block text-[11.5px]" style={{ color: MUTE }}>quem liga todos comprova tudo que vende</span>
        </span>
      </button>
    </div>
  );
}
