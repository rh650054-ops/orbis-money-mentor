/* Fila de revisão: um gasto por vez. Ao escolher: toque .97, check desenha (~250ms),
   o item sai com fade + slide curto, o contador desce e vibra (onde o aparelho deixa). */
import { useEffect, useRef, useState } from "react";
import { toast } from "@/shared/hooks/use-toast";
import { COR, CheckAnimado, Chip, Folha, haptic } from "../planejar/ui";
import { useAcaoLancamento, useCategoriasSaida } from "./use-analise";
import { dataCurta, reais, type Pendente } from "./tipos";

const RAPIDAS = ["mercado", "mercadoria", "contas_casa", "transporte_app", "restaurante", "delivery", "lazer", "outros"];

export function RevisarFolha({ aberta, pendentes, onFechar }: { aberta: boolean; pendentes: Pendente[]; onFechar: () => void }) {
  const [fila, setFila] = useState<Pendente[]>([]);
  const [feito, setFeito] = useState<string | null>(null);   // botão que mostra o check
  const [saindo, setSaindo] = useState(false);
  const [todas, setTodas] = useState(false);
  const travado = useRef(false);
  const cats = useCategoriasSaida();
  const acao = useAcaoLancamento();
  useEffect(() => { if (aberta) { setFila(pendentes); setTodas(false); } }, [aberta]); // eslint-disable-line react-hooks/exhaustive-deps

  const atual = fila[0];
  const confirmar = (categoria: string) => {
    if (!atual || travado.current) return;
    travado.current = true;
    haptic("sucesso");
    setFeito(categoria);
    acao.mutate({ tipo: "mover", id: atual.id, categoria, todos: false }, {
      onError: () => { toast({ title: "Não consegui salvar", description: "Tenta de novo em instantes.", variant: "destructive" }); setFila((f) => [atual, ...f.filter((p) => p.id !== atual.id)]); },
    });
    window.setTimeout(() => setSaindo(true), 250);
    window.setTimeout(() => {
      setFila((f) => f.slice(1)); setSaindo(false); setFeito(null); setTodas(false); travado.current = false;
    }, 250 + 220);
  };

  const opcoes = (cats.data ?? []).filter((c) => (todas ? c.slug !== "pix_pessoas" && c.slug !== "transferencia_propria" : RAPIDAS.includes(c.slug)));
  const botao = (slug: string, texto: string) => (
    <button key={slug} type="button" onClick={() => confirmar(slug)} disabled={!!feito}
      className="min-h-11 px-3 rounded-[12px] border inline-flex items-center gap-1.5 text-[15px] font-bold whitespace-nowrap transition-[transform,background-color] duration-100 active:scale-[0.97]"
      style={feito === slug ? { background: COR.verde, borderColor: COR.verde, color: "#08140d" } : { background: COR.surface2, borderColor: COR.borda, color: COR.texto }}>
      {feito === slug && <CheckAnimado tamanho={16} />}{texto}
    </button>
  );

  return (
    <Folha open={aberta} onOpenChange={(o) => { if (!o) onFechar(); }} titulo="Para revisar"
      subtitulo={fila.length > 0 ? `${fila.length} ${fila.length === 1 ? "gasto" : "gastos"} pra confirmar` : "Tudo confirmado"} alta>
      {!atual ? (
        <div className="py-6 text-center">
          <p className="text-[17px] font-bold" style={{ color: COR.verde }}>✓ Tudo organizado</p>
          <p className="text-[14px] mt-1" style={{ color: COR.sub }}>As categorias do mês já estão certas.</p>
        </div>
      ) : (
        <div key={atual.id} className="flex flex-col gap-4"
          style={{ opacity: saindo ? 0 : 1, transform: saindo ? "translateX(-24px)" : "none", transition: "opacity 220ms ease-out, transform 220ms ease-out" }}>
          <div className="rounded-[16px] border p-4" style={{ background: "#0e0e10", borderColor: "rgba(255,255,255,.07)" }}>
            <p className="text-[13px]" style={{ color: COR.mute }}>{dataCurta(atual.data)}{atual.banco ? ` · ${atual.banco}` : ""}</p>
            <div className="flex items-baseline justify-between gap-3 mt-1">
              <p className="text-[17px] font-bold truncate" style={{ color: COR.texto }}>{atual.nome}</p>
              <p className="text-[20px] font-extrabold tabular-nums shrink-0" style={{ color: COR.texto }}>{reais(atual.valor)}</p>
            </div>
          </div>
          <p className="text-[15px] font-semibold" style={{ color: COR.texto }}>O que foi esse gasto?</p>
          <div className="flex flex-wrap gap-2">
            {opcoes.map((c) => botao(c.slug, c.rotulo))}
            {!todas && <Chip ativo={false} onClick={() => setTodas(true)}>Outra…</Chip>}
          </div>
          <div className="flex flex-wrap gap-2 pt-1 border-t" style={{ borderColor: "rgba(255,255,255,.06)" }}>
            {botao("pix_pessoas", "Pix pra pessoa mesmo")}
            {botao("transferencia_propria", "Entre minhas contas")}
          </div>
        </div>
      )}
    </Folha>
  );
}
