/* ============================================================
   NOVO DESAFIO DE LUCRO (Rick, 27/10/2026)
   "Quero R$ 5.000 de lucro em 15 dias" → the Vant reads the last 60 days
   (DEFCON + Open Finance) and answers how many units per day that takes,
   whether it fits the average, and how much to produce.
   ============================================================ */
import { useMemo, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Gaveta } from "@/shared/components/gaveta";
import { Skeleton } from "@/shared/ui/skeleton";
import { toast } from "@/shared/hooks/use-toast";
import { useAnaliseLucroQuery, useCriarDesafioMutation } from "../api/use-objetivo-lucro";
import { diasSugeridos, planoLucro } from "../lib/plano";
import { PassoMeta } from "./passo-meta";
import { PlanoCard } from "./plano-card";
import { RitmoCard } from "./ritmo-card";
import { COR } from "./ui";
import { brl0 } from "../lib/formato";

export function NovoDesafioSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [passo, setPasso] = useState<1 | 2>(1);
  const [alvo, setAlvo] = useState(5000);
  const [dias, setDias] = useState(15);
  const [diasTrabalho, setDiasTrabalho] = useState<number | null>(null);
  const analise = useAnaliseLucroQuery(open);
  const criar = useCriarDesafioMutation();
  const b = analise.data ?? null;
  const trabalho = Math.min(dias, diasTrabalho ?? (b ? diasSugeridos(b, dias) : dias));
  const plano = useMemo(() => (b ? planoLucro(b, alvo, trabalho) : null), [b, alvo, trabalho]);

  const fechar = (o: boolean) => {
    onOpenChange(o);
    if (!o) { setPasso(1); setDiasTrabalho(null); }
  };
  const salvar = () => {
    criar.mutate({ alvo, dias, diasTrabalho: trabalho }, {
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
              {passo === 1 ? "A Vant analisa seu corre e monta o plano" : "O plano pelo seu ritmo de verdade"}
            </p>
          </div>
        </div>

        {passo === 1 ? (
          <PassoMeta alvo={alvo} dias={dias} onAlvo={setAlvo} onDias={(d) => { setDias(d); setDiasTrabalho(null); }} onAnalisar={() => setPasso(2)} />
        ) : analise.isLoading ? (
          <div className="mt-4 flex flex-col gap-3"><Skeleton className="h-48 w-full rounded-[18px]" /><Skeleton className="h-32 w-full rounded-[18px]" /></div>
        ) : !b || !plano ? (
          <p className="text-[13px] mt-5" style={{ color: COR.sub }}>Não consegui ler seus dados agora. Tenta de novo em instantes.</p>
        ) : (
          <>
            <RitmoCard b={b} />
            <PlanoCard b={b} p={plano} alvo={alvo} dias={dias} diasTrabalho={trabalho} onDiasTrabalho={setDiasTrabalho} />
            <button type="button" disabled={criar.isPending || plano.unidDia === null} onClick={salvar}
              className="orbis-cta w-full mt-4 disabled:opacity-40 flex items-center justify-center gap-2" style={{ height: 56 }}>
              {criar.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
              CRIAR DESAFIO
            </button>
            {plano.unidDia === null && (
              <p className="text-[12px] mt-2 text-center" style={{ color: COR.mute }}>Cadastre o preço e o custo do produto pra Vant calcular o lucro.</p>
            )}
          </>
        )}
      </div>
    </Gaveta>
  );
}
