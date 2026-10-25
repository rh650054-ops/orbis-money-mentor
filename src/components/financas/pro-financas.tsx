/* ============================================================
   FINANÇAS NO ESSENCIAL (Rick, 25/10/2026 — mockup aprovado)
   O Essencial faz tudo na mão. O desejo vem de ver, FOSCO, o que o banco faria
   sozinho no Pro. Os números foscos são EXEMPLO (sem banco a Vant não lê nada),
   e o texto diz isso. Limites do Essencial: 5 contas abertas e 2 objetivos ativos
   (a trava de verdade é no servidor; quem já tinha mais fica com o que tem).
   Puro: recebe tudo por props.
   ============================================================ */
import { CreditCard, Landmark, Lock, Plus, Sparkles, TrendingUp, Zap } from "lucide-react";
import { DadoPro } from "@/shared/components/pro/dado-pro";

export const LIMITE_CONTAS_ESSENCIAL = 5;
export const LIMITE_OBJETIVOS_ESSENCIAL = 2;

const GOLD = "#F5B800", OK = "#3DD68C", SUB = "#b9b3a6", MUTE = "#7b766e";
const caixa = { border: "1px solid rgba(255,255,255,.08)", background: "#0e0e10" } as const;
const ouro = { border: `1px solid ${GOLD}55`, background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)" } as const;
const botaoOuro = { background: "linear-gradient(180deg,#FFC63A,#F5B800)", color: "#1a1408" } as const;

function Botao({ children, onClick, alto = false }: { children: React.ReactNode; onClick: () => void; alto?: boolean }) {
  return (
    <button type="button" onClick={onClick} style={botaoOuro}
      className={`w-full ${alto ? "h-12 text-[14px]" : "h-11 text-[13.5px]"} mt-3 rounded-[14px] font-black inline-flex items-center justify-center gap-2 active:scale-[.99] transition`}>
      {children}
    </button>
  );
}

/** Planejar: "no Pro a Vant acha suas contas no banco" — exemplo fosco */
export function ContasDoBancoPro({ onPro }: { onPro: () => void }) {
  return (
    <section className="rounded-[18px] px-4 py-3.5" style={ouro} aria-label="Contas lidas do banco no Pro">
      <p className="inline-flex items-center gap-1.5 text-[10.5px] font-black tracking-[.14em]" style={{ color: GOLD }}>
        <Sparkles className="w-3.5 h-3.5" /> NO PRO, A VANT ACHA SUAS CONTAS NO BANCO
      </p>
      <DadoPro travado compacto chamada="Exemplo · só no Pro">
        {[["Cartão de crédito", "R$ 690", "vence dia 10"], ["Conta de água", "R$ 74", "vence dia 12"], ["Streaming", "R$ 39", "vence dia 15"], ["Financiamento", "R$ 412", "vence dia 20"]].map(([a, b, c]) => (
          <div key={a} className="flex justify-between py-1.5 text-[13px]"><span className="font-bold">{a}</span><span><b>{b}</b> <span style={{ color: MUTE }}>· {c}</span></span></div>
        ))}
      </DadoPro>
      <p className="text-[12px] mt-2 leading-snug" style={{ color: SUB }}>
        No Pro a Vant lê seu extrato, cadastra as contas sozinha e marca como <b style={{ color: OK }}>paga</b> quando o dinheiro sai.
      </p>
      <Botao onClick={onPro}><Lock className="w-4 h-4" strokeWidth={2.6} /> Ver minhas contas com o Pro</Botao>
    </section>
  );
}

/** Planejar: previsão do mês (entra · sai · sobra) — exemplo fosco */
export function MesFechaPro() {
  return (
    <section className="rounded-[18px] px-4 py-3.5" style={caixa} aria-label="Previsão do mês no Pro">
      <p className="inline-flex items-center gap-2 text-[13px] font-extrabold"><TrendingUp className="w-4 h-4" style={{ color: GOLD }} /> Como seu mês vai fechar</p>
      <DadoPro travado chamada="Previsão do Pro">
        <div className="grid grid-cols-3 gap-1.5 mt-2.5">
          {[["Entra", "R$ 6.840"], ["Sai", "R$ 4.210"], ["Sobra", "R$ 2.630"]].map(([k, v], i) => (
            <div key={k} className="rounded-[12px] px-2 py-1.5" style={{ background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.08)" }}>
              <p className="text-[9px] font-bold uppercase" style={{ color: MUTE }}>{k}</p>
              <p className="text-[13px] font-extrabold" style={i === 2 ? { color: OK } : undefined}>{v}</p>
            </div>
          ))}
        </div>
      </DadoPro>
    </section>
  );
}

/** Limite do Essencial (contas / objetivos): "Você usou 5 de 5. No Pro é sem limite." */
export function LimitePlano({ titulo, usados, limite, onPro }: { titulo: string; usados: number; limite: number; onPro: () => void }) {
  return (
    <button type="button" onClick={onPro} className="w-full rounded-[16px] px-4 py-3 flex items-center gap-3 text-left active:opacity-80" style={caixa}>
      <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.12)", color: GOLD }}><Plus className="w-4 h-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-extrabold">{titulo}</span>
        <span className="block text-[11.5px]" style={{ color: SUB }}>Você usou <b className="text-[#F4F1EA]">{Math.min(usados, limite)} de {limite}</b> no Essencial. No Pro é sem limite.</span>
      </span>
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-black shrink-0" style={{ border: `1px solid ${GOLD}66`, color: GOLD }}><Lock className="w-3 h-3" /> PRO</span>
    </button>
  );
}

/** Aba Bancos no Essencial: aparece com cadeado e tudo fosco (exemplo) */
export function BancosTravado({ onPro }: { onPro: () => void }) {
  return (
    <div className="flex flex-col gap-3" aria-label="Bancos no VANT Pro">
      <section className="rounded-[18px] px-4 py-3.5" style={caixa}>
        <p className="inline-flex items-center gap-2 text-[13px] font-extrabold"><Landmark className="w-4 h-4" style={{ color: GOLD }} /> Seu dinheiro agora</p>
        <DadoPro travado chamada="Lido do banco no Pro">
          <p className="text-[30px] font-black mt-2">R$ 2.418,30</p>
          <p className="text-[12px]" style={{ color: SUB }}>em 2 bancos · atualizado agora</p>
        </DadoPro>
      </section>
      <section className="rounded-[18px] px-4 py-3.5" style={caixa}>
        <p className="inline-flex items-center gap-2 text-[13px] font-extrabold"><CreditCard className="w-4 h-4" style={{ color: GOLD }} /> Cartão de crédito</p>
        <DadoPro travado compacto>
          <div className="flex justify-between mt-2 text-[13px]"><span>Fatura atual</span><b>R$ 690,12</b></div>
          <div className="flex justify-between mt-1 text-[13px]"><span>Limite livre</span><b style={{ color: OK }}>R$ 1.309,88</b></div>
        </DadoPro>
      </section>
      <section className="rounded-[18px] px-4 py-3.5" style={caixa}>
        <p className="inline-flex items-center gap-2 text-[13px] font-extrabold"><Zap className="w-4 h-4" style={{ color: GOLD }} /> Pra onde foi seu dinheiro no mês</p>
        <DadoPro travado compacto>
          {([["Mercadoria", "R$ 1.420", 62], ["Casa", "R$ 980", 43], ["Comida fora", "R$ 410", 18], ["Transporte", "R$ 260", 11]] as const).map(([a, b, w]) => (
            <div key={a} className="mt-2">
              <div className="flex justify-between text-[12.5px]"><span>{a}</span><b>{b}</b></div>
              <div className="h-1.5 rounded-full mt-1" style={{ background: "rgba(255,255,255,.08)" }}><div className="h-full rounded-full" style={{ width: `${w}%`, background: GOLD }} /></div>
            </div>
          ))}
        </DadoPro>
      </section>
      <section className="rounded-[18px] px-4 py-4 text-center" style={ouro}>
        <p className="text-[16px] font-black">Pare de anotar. Deixe o banco contar.</p>
        <p className="text-[12.5px] mt-1" style={{ color: SUB }}>Saldo, cartão, contas e gastos lidos sozinhos do seu banco. A senha nunca passa pela Vant.</p>
        <Botao onClick={onPro} alto>Liberar com o VANT Pro</Botao>
      </section>
      <p className="text-[11px] text-center" style={{ color: MUTE }}>Os valores foscos são um exemplo de como aparece no Pro.</p>
    </div>
  );
}
