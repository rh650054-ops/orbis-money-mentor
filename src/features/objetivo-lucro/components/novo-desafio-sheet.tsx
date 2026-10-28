/* ============================================================
   NOVO DESAFIO DE LUCRO (Rick, 27/10/2026)
   "Quero R$ 5.000 de lucro em 15 dias" → the Vant AI reads the last 60 days
   (bank, app sales, calotes, cost per product) and answers with a verdict,
   units per day and a plan. Changing the work days recalculates the number
   locally; "Reanalisar" asks the AI again.
   ============================================================ */
import { useMemo, useState } from "react";
import { ChevronLeft, Loader2, RefreshCw } from "lucide-react";
import { Gaveta } from "@/shared/components/gaveta";
import { toast } from "@/shared/hooks/use-toast";
import { useAnalisarComIaMutation, useCriarDesafioMutation, type AnaliseIa } from "../api/use-objetivo-lucro";
import { useClimaPlano } from "../api/use-clima-plano";
import { diasSugeridos, planoLucro } from "../lib/plano";
import { cronograma, type DiasFixos } from "../lib/cronograma";
import { baseComCalote } from "../lib/calote";
import type { FonteCalote } from "../types";
import { brl0 } from "../lib/formato";
import { FontesLidas } from "./fontes-lidas";
import { LendoCorre } from "./lendo-corre";
import { PassoMeta } from "./passo-meta";
import { PlanoIaCard } from "./plano-ia";
import { CurvaMissao } from "./curva-missao";
import { CronogramaDias } from "./cronograma-dias";
import { PainelMissao } from "./painel-missao";
import { VereditoHero } from "./veredito-hero";
import { COR } from "./ui";

export function NovoDesafioSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [passo, setPasso] = useState<1 | 2>(1);
  const [alvo, setAlvo] = useState(5000);
  const [dias, setDias] = useState(15);
  const [diasTrabalho, setDiasTrabalho] = useState<number | null>(null);
  const [resultado, setResultado] = useState<AnaliseIa | null>(null);
  // 28/10: days he fixed by tapping in the schedule, and which calote estimate the mission uses
  const [fixos, setFixos] = useState<Map<string, boolean>>(new Map());
  const [fonteCalote, setFonteCalote] = useState<FonteCalote | null>(null);
  const analisar = useAnalisarComIaMutation();
  const criar = useCriarDesafioMutation();
  const clima = useClimaPlano(open);

  const fonte: FonteCalote = fonteCalote ?? resultado?.base.calote.fonte ?? "app";
  const b = useMemo(() => (resultado ? baseComCalote(resultado.base, fonte) : null), [resultado, fonte]);
  const ia = resultado?.ia ?? null;
  // Work days: what the person chose → what the AI analysed with → his usual rhythm.
  const pedido = Math.min(dias, diasTrabalho ?? resultado?.diasTrabalho ?? (b ? diasSugeridos(b, dias) : dias));
  const crono = useMemo(() => (b ? cronograma(b, alvo, dias, pedido, new Date(), clima.plano, fixos) : null), [b, alvo, dias, pedido, clima.plano, fixos]);
  const trabalho = crono?.diasTrabalho ?? pedido;
  const plano = useMemo(() => (b ? planoLucro(b, alvo, trabalho) : null), [b, alvo, trabalho]);
  // The AI's number stands while the work days and the cost are the ones it analysed; otherwise recalc.
  const unidDia = ia?.unid_dia && diasTrabalho === null && fixos.size === 0 && fonteCalote === null ? ia.unid_dia : plano?.unidDia ?? null;

  const rodar = (dt?: number) => {
    setPasso(2);
    // First run sends no work days: the function uses his frequency (e.g. 9 of 15).
    analisar.mutate({ alvo, dias, ...(dt ? { diasTrabalho: Math.min(dias, dt) } : {}), ...(fonteCalote ? { caloteFonte: fonteCalote } : {}) }, {
      onSuccess: (r) => { setResultado(r); setDiasTrabalho(null); if (r.limite) toast({ title: "Limite de análises por hoje", description: "Mostrei o plano pela sua média." }); },
      onError: () => { toast({ title: "Não consegui ler seus dados", description: "Tenta de novo em instantes.", variant: "destructive" }); setPasso(1); },
    });
  };
  const alternarDia = (data: string) => {
    const atual = crono?.dias.find((d) => d.data === data);
    if (!atual) return;
    setFixos((f) => { const n = new Map(f); n.set(data, !atual.trabalha); return n; });
    setDiasTrabalho(null);
  };
  const fechar = (o: boolean) => {
    onOpenChange(o);
    if (!o) { setPasso(1); setDiasTrabalho(null); setResultado(null); setFixos(new Map()); setFonteCalote(null); }
  };
  const salvar = () => {
    if (!crono) return;
    const planoDias = crono.dias.map((d) => ({ d: d.data, t: d.trabalha, u: d.unid }));
    criar.mutate({ alvo, dias, diasTrabalho: trabalho, ia, plano: planoDias, caloteFonte: fonte }, {
      onSuccess: () => { toast({ title: "Desafio criado", description: `${brl0(alvo)} de lucro em ${dias} dias. Bora!` }); fechar(false); },
      onError: () => toast({ title: "Não deu pra criar o desafio", description: "Tenta de novo em instantes.", variant: "destructive" }),
    });
  };

  return (
    <Gaveta open={open} onOpenChange={fechar} titulo="Bater um lucro" className="max-h-[94vh]" style={{ background: COR.fundo, borderColor: "#2a2416" }}>
      <div className="px-[18px] pt-1" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => (passo === 2 ? setPasso(1) : fechar(false))} aria-label="Voltar"
            className="w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0" style={{ background: COR.caixa, border: `1px solid ${COR.linha}` }}>
            <ChevronLeft className="w-[18px] h-[18px]" style={{ color: COR.sub }} strokeWidth={2.4} />
          </button>
          <div className="min-w-0">
            <h3 className="text-[22px] font-black tracking-tight leading-none text-foreground">
              {passo === 1 ? "Bater um lucro" : "Briefing da missão"}
            </h3>
            <p className="text-[12.5px] mt-1" style={{ color: COR.mute }}>
              {passo === 1 ? "A Vant lê seu banco, suas vendas e seus calotes" : "Feito pela IA com seus últimos 60 dias"}
            </p>
          </div>
        </div>

        {passo === 1 ? (
          <PassoMeta alvo={alvo} dias={dias} onAlvo={setAlvo} onDias={(d) => { setDias(d); setDiasTrabalho(null); setFixos(new Map()); }} onAnalisar={() => rodar()} />
        ) : analisar.isPending || !b || !plano || !crono ? (
          <LendoCorre pronto={false} nome={b?.apelido ?? null} />
        ) : (
          <>
            <VereditoHero b={b} p={plano} ia={ia} alvo={alvo} dias={dias} unidDia={unidDia} diasTrabalho={trabalho} />
            <FontesLidas b={b} fonteCalote={fonte} onFonteCalote={setFonteCalote} />
            <CronogramaDias b={b} c={crono} impacto={clima.impacto} dias={dias} diasTrabalho={trabalho} sugestaoIa={ia?.dias_trabalho ?? null}
              onDiasTrabalho={(n) => { setDiasTrabalho(n); setFixos(new Map()); }} fixos={fixos as DiasFixos} onAlternarDia={alternarDia} />
            <CurvaMissao c={crono} alvo={alvo} />
            <PainelMissao b={b} c={crono} diasTrabalho={trabalho} />
            <PlanoIaCard ia={ia} />
            {(diasTrabalho !== null || fixos.size > 0 || fonteCalote !== null) && ia && (
              <button type="button" onClick={() => rodar(trabalho)} className="w-full h-10 mt-2 text-[12.5px] font-bold inline-flex items-center justify-center gap-1.5" style={{ color: COR.ouro }}>
                <RefreshCw className="w-3.5 h-3.5" /> Reanalisar com {trabalho} dias{fonteCalote ? ` · calote ${fonteCalote === "banco" ? "pelo banco" : "do app"}` : ""}
              </button>
            )}
            <button type="button" disabled={criar.isPending || unidDia === null} onClick={salvar}
              className="orbis-cta w-full mt-4 disabled:opacity-40 flex items-center justify-center gap-2" style={{ height: 56 }}>
              {criar.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
              ACEITAR A MISSÃO
            </button>
            {unidDia === null && (
              <p className="text-[12px] mt-2 text-center" style={{ color: COR.mute }}>Cadastre o preço e o custo do produto pra Vant calcular o lucro.</p>
            )}
          </>
        )}
      </div>
    </Gaveta>
  );
}
