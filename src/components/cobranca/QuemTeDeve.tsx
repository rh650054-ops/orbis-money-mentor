/* ============================================================
   COBRADOR · QUEM TE DEVE (mockup cobrador.png, 03/10/2026)
   • ResumoRecuperado: "2 de 3 cobranças pagas · Você recuperou R$ 270 esse mês"
   • ListaDevedores: os clientes de hoje que levaram e não pagaram + as cobranças
     abertas (esperando, vencidas, hora de cobrar de novo)
   • FilaEnvio: "COBRAR OS 3 DE UMA VEZ" cria todos os Pix de uma vez; o WhatsApp
     só abre uma conversa por toque, então a fila leva de um em um.
   ============================================================ */
import { Check, Copy, MessageCircle, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { fmt, horaBR, iniciais, primeiroNome, telefoneBonito, telefoneServe, type ClienteDoDia } from "./cobranca-lib";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const RED = "#ff8a97";
const MUTE = "var(--orbis-fg-3)";

export interface CobrancaAberta {
  id: string; nome: string | null; telefone: string | null; valor: number; descricao: string | null;
  status: string; criada_em: string; enviada_em: string | null; expira_em: string | null;
  lembrar_em: string | null; client_id: string | null; hora_de_cobrar: boolean;
}
export interface PainelCobranca { recuperado_mes: number; pagas_mes: number; criadas_mes: number; abertas: CobrancaAberta[] }
export const PAINEL_VAZIO: PainelCobranca = { recuperado_mes: 0, pagas_mes: 0, criadas_mes: 0, abertas: [] };

export async function carregarPainel(): Promise<PainelCobranca> {
  const { data, error } = await (supabase as unknown as { rpc: (f: string) => Promise<{ data: unknown; error: unknown }> }).rpc("cobrancas_painel");
  if (error || !data) { if (error) avisar.silencioso("cobrancas_painel", error); return PAINEL_VAZIO; }
  const p = data as PainelCobranca;
  return {
    recuperado_mes: Number(p.recuperado_mes) || 0, pagas_mes: Number(p.pagas_mes) || 0, criadas_mes: Number(p.criadas_mes) || 0,
    abertas: (p.abertas ?? []).map((a) => ({ ...a, valor: Number(a.valor) || 0 })),
  };
}

const ddmm = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

export function ResumoRecuperado({ p }: { p: PainelCobranca }) {
  if (p.criadas_mes === 0) return null;
  return (
    <div className="rounded-[20px] p-4 flex gap-3 items-start" style={{ background: "linear-gradient(170deg,#0d2340,#0a1220 70%)", border: "1px solid rgba(63,169,255,.3)" }}>
      <span className="w-10 h-10 rounded-[12px] shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(180deg,#4aa3ff,#1560e8)" }}>
        <Check className="w-5 h-5 text-white" strokeWidth={3} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black tracking-[.16em]" style={{ color: "#8cc2ff" }}>{p.pagas_mes} DE {p.criadas_mes} COBRANÇAS PAGAS</p>
        <p className="text-[15px] font-black mt-0.5">Você recuperou {fmt(p.recuperado_mes)} esse mês</p>
        <p className="text-[11.5px] mt-1 leading-relaxed" style={{ color: "#9fb0c8" }}>Antes da Vant isso ia virar prejuízo e você nem lembraria de quem.</p>
      </div>
    </div>
  );
}

function Linha({ nome, sub, valor, tag, tom, onClick, primeiro }: {
  nome: string; sub: string; valor: number; tag?: string; tom: "ouro" | "cinza" | "verde"; onClick: () => void; primeiro?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left flex items-center gap-3 py-3 active:opacity-70"
      style={{ borderTop: primeiro ? "none" : "1px solid var(--orbis-line)" }}>
      <span className="w-[38px] h-[38px] rounded-[12px] shrink-0 flex items-center justify-center text-[12px] font-black"
        style={{ background: "rgba(242,70,90,.12)", border: "1px solid rgba(242,70,90,.35)", color: RED }}>{iniciais(nome)}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-extrabold truncate">{nome}</span>
        <span className="block text-[11px] truncate" style={{ color: tag ? (tom === "verde" ? OK : GOLD) : MUTE }}>{tag ?? sub}</span>
        {tag && <span className="block text-[11px] truncate" style={{ color: MUTE }}>{sub}</span>}
      </span>
      <span className="shrink-0 h-8 px-3 rounded-[10px] inline-flex items-center text-[12px] font-black"
        style={tom === "ouro" ? { background: "linear-gradient(180deg,#FFE27A,#F5B800)", color: "#1A1200" }
          : { background: "#17171a", border: "1px solid #2a2a2e", color: "#d9d4cc" }}>
        {fmt(valor).replace(/,00$/, "")}
      </span>
    </button>
  );
}

export function ListaDevedores({ novos, abertas, onNovo, onAberta }: {
  novos: ClienteDoDia[]; abertas: CobrancaAberta[]; onNovo: (c: ClienteDoDia) => void; onAberta: (a: CobrancaAberta) => void;
}) {
  if (novos.length === 0 && abertas.length === 0) return null;
  return (
    <div className="rounded-[20px] border px-4 pt-3.5 pb-1" style={{ borderColor: "rgba(242,70,90,.25)", background: "linear-gradient(180deg,#140b0d,#0b0b0d)" }}>
      <p className="text-[9.5px] font-black tracking-[.18em]" style={{ color: MUTE }}>QUEM TE DEVE</p>
      {novos.map((c, i) => (
        <Linha key={c.client_id} primeiro={i === 0} nome={c.nome || "Cliente"} valor={c.valor} tom="ouro" onClick={() => onNovo(c)}
          sub={`levou ${c.hora ? horaBR(c.hora) : "hoje"} · ${telefoneServe(c.telefone) ? telefoneBonito(c.telefone) : "sem telefone"}`} />
      ))}
      {abertas.map((a, i) => {
        const venceu = a.status === "expirada";
        const tag = a.hora_de_cobrar ? "hora de cobrar de novo"
          : venceu ? "o Pix venceu · gere outro"
          : a.lembrar_em ? `te lembro dia ${ddmm(a.lembrar_em)}`
          : a.enviada_em ? `esperando pagar · enviado ${horaBR(a.enviada_em)}` : "Pix criado · falta mandar";
        return (
          <Linha key={a.id} primeiro={novos.length === 0 && i === 0} nome={a.nome || "Cliente"} valor={a.valor}
            tom={a.hora_de_cobrar || venceu ? "ouro" : "cinza"} tag={tag} onClick={() => onAberta(a)}
            sub={`${a.descricao || "cobrança"} · ${ddmm(a.criada_em)}`} />
        );
      })}
    </div>
  );
}

export interface ItemFila { id: string; nome: string | null; telefone: string | null; valor: number; link: string | null; enviado: boolean }

export function FilaEnvio({ itens, falhas, onMandar, onCopiar, onPronto }: {
  itens: ItemFila[]; falhas: number; onMandar: (i: ItemFila) => void; onCopiar: (i: ItemFila) => void; onPronto: () => void;
}) {
  const proximo = itens.find((i) => !i.enviado);
  const feitos = itens.filter((i) => i.enviado).length;
  return (
    <div className="space-y-3">
      <div className="rounded-[22px] p-4 text-center" style={{ background: "linear-gradient(180deg,#0b1a14,#08110d)", border: "1px solid rgba(37,211,102,.28)" }}>
        <p className="text-[10px] font-black tracking-[.18em]" style={{ color: "#5fd98a" }}>{itens.length} PIX CRIADOS NA SUA CONTA</p>
        <p className="text-[20px] font-black mt-1">{proximo ? `Agora é só mandar: ${feitos} de ${itens.length}` : "Mandou pra todo mundo"}</p>
        <p className="text-[11.5px] mt-1" style={{ color: MUTE }}>O WhatsApp abre uma conversa por vez. Mandou, volta aqui que já vem o próximo.</p>
        {falhas > 0 && <p className="text-[11.5px] mt-1.5" style={{ color: RED }}>{falhas} não deu pra criar. Tenta de novo pela lista.</p>}
      </div>
      <div className="rounded-[20px] border px-4 py-1" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
        {itens.map((i, k) => {
          const vez = proximo?.id === i.id;
          const temTel = telefoneServe(i.telefone);
          return (
            <div key={i.id} className="flex items-center gap-3 py-3" style={{ borderTop: k === 0 ? "none" : "1px solid var(--orbis-line)" }}>
              <span className="w-[34px] h-[34px] rounded-[11px] shrink-0 flex items-center justify-center text-[11.5px] font-black"
                style={i.enviado ? { background: "rgba(61,214,140,.1)", border: `1px solid ${OK}66`, color: OK } : { background: "#16151a", border: "1px solid #2a2823", color: "#d9d4cc" }}>
                {i.enviado ? <Check className="w-4 h-4" strokeWidth={3} /> : iniciais(i.nome)}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-extrabold truncate">{i.nome || "Cliente"}</span>
                <span className="block text-[11px]" style={{ color: MUTE }}>{fmt(i.valor)}{temTel ? "" : " · sem WhatsApp"}</span>
              </span>
              {i.enviado ? <span className="text-[11px] font-black" style={{ color: OK }}>ENVIADO</span>
                : temTel ? (
                  <button type="button" onClick={() => onMandar(i)} className="h-9 px-3 rounded-[11px] inline-flex items-center gap-1.5 text-[12px] font-black"
                    style={vez ? { background: "#25D366", color: "#04220f" } : { background: "#17171a", border: "1px solid #2a2a2e", color: "#d9d4cc" }}>
                    <MessageCircle className="w-4 h-4" /> {vez ? `mandar pro ${primeiroNome(i.nome) || "cliente"}` : "mandar"}
                  </button>
                ) : (
                  <button type="button" onClick={() => onCopiar(i)} className="h-9 px-3 rounded-[11px] inline-flex items-center gap-1.5 text-[12px] font-black"
                    style={{ background: "#17171a", border: "1px solid #2a2a2e", color: "#d9d4cc" }}>
                    <Copy className="w-4 h-4" /> copiar link
                  </button>
                )}
            </div>
          );
        })}
      </div>
      <button type="button" onClick={onPronto} className="w-full h-[50px] rounded-[16px] text-[13.5px] font-black"
        style={{ background: "#111114", border: "1px solid #232327" }}>
        {proximo ? "Termino depois" : "Pronto, ver quem ainda deve"}
      </button>
    </div>
  );
}

export function BotaoLembrar({ lembrarEm, onLembrar }: { lembrarEm: string | null; onLembrar: () => void }) {
  return (
    <button type="button" onClick={onLembrar} disabled={!!lembrarEm}
      className="w-full h-[48px] rounded-[16px] mt-3 inline-flex items-center justify-center gap-2 text-[13px] font-black disabled:opacity-70"
      style={{ background: "#111114", border: "1px solid #232327", color: "#e9e6df" }}>
      <BellRing className="w-4 h-4" style={{ color: GOLD }} />
      {lembrarEm ? `Te lembro de cobrar dia ${ddmm(lembrarEm)}` : "cobrar de novo daqui a 2 dias"}
    </button>
  );
}
