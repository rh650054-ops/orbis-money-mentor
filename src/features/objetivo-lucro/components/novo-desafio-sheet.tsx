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
import { diasSugeridos, planoLucro } from "../lib/plano";
import { brl0 } from "../lib/formato";
import { FontesLidas } from "./fontes-lidas";
import { LendoCorre } from "./lendo-corre";
import { PassoMeta } from "./passo-meta";
import { PlanoIaCard } from "./plano-ia";
import { VereditoHero } from "./veredito-hero";
import { COR } from "./ui";

export function NovoDesafioSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [passo, setPasso] = useState<1 | 2>(1);
  const [alvo, setAlvo] = useState(5000);
  const [dias, setDias] = useState(15);
  const [diasTrabalho, setDiasTrabalho] = useState<number | null>(null);
  const [resultado, setResultado] = useState<AnaliseIa | null>(null);
  const analisar = useAnalisarComIaMutation();
  const criar = useCriarDesafioMutation();

  const b = resultado?.base ?? null;
  const ia = resultado?.ia ?? null;
  const trabalho = Math.min(dias, diasTrabalho ?? ia?.dias_trabalho ?? (b ? diasSugeridos(b, dias) : dias));
  const plano = useMemo(() => (b ? planoLucro(b, alvo, trabalho) : null), [b, alvo, trabalho]);
  // The AI's number stands while the work days are the ones it analysed; otherwise recalc.
  const unidDia = ia?.unid_dia && diasTrabalho === null ? ia.unid_dia : plano?.unidDia ?? null;

  const rodar = (dt?: number) => {
    const d = dt ?? (b ? diasSugeridos(b, dias) : dias);
    setPasso(2);
    analisar.mutate({ alvo, dias, diasTrabalho: Math.min(dias, d) }, {
      onSuccess: (r) => { setResultado(r); setDiasTrabalho(null); if (r.limite) toast({ title: "Limite de análises por hoje", description: "Mostrei o plano pela sua média." }); },
      onError: () => { toast({ title: "Não consegui ler seus dados", description: "Tenta de novo em instantes.", variant: "destructive" }); setPasso(1); },
    });
  };
  const fechar = (o: boolean) => {
    onOpenChange(o);
    if (!o) { setPasso(1); setDiasTrabalho(null); setResultado(null); }
  };
  const salvar = () => {
    criar.mutate({ alvo, dias, diasTrabalho: trabalho, ia }, {
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
              {passo === 1 ? "Bater um lucro" : `${brl0(alvo)} em ${dias} dias`}
            </h3>
            <p className="text-[12.5px] mt-1" style={{ color: COR.mute }}>
              {passo === 1 ? "A Vant lê seu banco e suas vendas e monta o plano" : "Plano feito pela IA com seus últimos 60 dias"}
            </p>
          </div>
        </div>

        {passo === 1 ? (
          <PassoMeta alvo={alvo} dias={dias} onAlvo={setAlvo} onDias={(d) => { setDias(d); setDiasTrabalho(null); }} onAnalisar={() => rodar()} />
        ) : analisar.isPending || !b || !plano ? (
          <LendoCorre pronto={false} />
        ) : (
          <>
            <VereditoHero b={b} p={plano} ia={ia} unidDia={unidDia} diasTrabalho={trabalho} />
            <FontesLidas b={b} />
            <PlanoIaCard b={b} p={plano} ia={ia} dias={dias} diasTrabalho={trabalho} onDiasTrabalho={setDiasTrabalho} />
            {diasTrabalho !== null && ia && (
              <button type="button" onClick={() => rodar(trabalho)} className="w-full h-10 mt-2 text-[12.5px] font-bold inline-flex items-center justify-center gap-1.5" style={{ color: COR.ouro }}>
                <RefreshCw className="w-3.5 h-3.5" /> Reanalisar com {trabalho} dias
              </button>
            )}
            <button type="button" disabled={criar.isPending || unidDia === null} onClick={salvar}
              className="orbis-cta w-full mt-4 disabled:opacity-40 flex items-center justify-center gap-2" style={{ height: 56 }}>
              {criar.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
              CRIAR DESAFIO
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
