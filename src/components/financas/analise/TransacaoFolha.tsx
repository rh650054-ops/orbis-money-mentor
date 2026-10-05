/* Ações de uma transação: ver, mudar categoria (só esta ou todas do mesmo nome),
   marcar como transferência entre contas, tirar da análise e corrigir o nome. */
import { useEffect, useState } from "react";
import { ArrowLeftRight, Check, EyeOff, Pencil, Tag } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { BotaoPrimario, COR, Chip, Folha, LinhaValor, haptic } from "../planejar/ui";
import { useAcaoLancamento, useCategoriasSaida, type AcaoLancamento } from "./use-analise";
import { A_REVISAR, dataCurta, reais, type Lancamento } from "./tipos";

type Modo = "ver" | "categoria" | "nome";

function Acao({ icone: Icone, children, onClick }: { icone: typeof Tag; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={() => { haptic(); onClick(); }}
      className="w-full min-h-12 flex items-center gap-3 text-left text-[15px] font-semibold border-t first:border-t-0 rounded-[10px] transition-[transform,background-color] duration-[120ms] active:scale-[0.99] active:bg-white/[.05]"
      style={{ borderColor: "rgba(255,255,255,.06)", color: COR.texto }}>
      <Icone className="w-5 h-5 shrink-0" strokeWidth={2} style={{ color: COR.sub }} />{children}
    </button>
  );
}

export function TransacaoFolha({ l, onFechar }: { l: Lancamento | null; onFechar: () => void }) {
  const [modo, setModo] = useState<Modo>("ver");
  const [nova, setNova] = useState<string | null>(null);
  const [todos, setTodos] = useState(false);
  const [nome, setNome] = useState("");
  const cats = useCategoriasSaida();
  const acao = useAcaoLancamento();
  useEffect(() => {
    if (!l) return;
    setModo("ver"); setNova(null); setNome(l.apelido ?? l.nome);
    setTodos(l.mesmo_nome > 1 && !A_REVISAR.has(l.categoria));
  }, [l]);
  if (!l) return null;

  const rodar = (a: AcaoLancamento, ok: string) => acao.mutate(a, {
    onSuccess: () => { haptic("sucesso"); toast({ title: ok }); onFechar(); },
    onError: () => toast({ title: "Não consegui salvar", description: "Tenta de novo em instantes.", variant: "destructive" }),
  });
  const rotulo = (slug: string) => cats.data?.find((c) => c.slug === slug)?.rotulo ?? slug;

  return (
    <Folha open onOpenChange={(o) => { if (!o) onFechar(); }} titulo={l.nome} subtitulo={`${dataCurta(l.data)}${l.hora ? ` às ${l.hora}` : ""}${l.banco ? ` · ${l.banco}` : ""}`}>
      <p className="-mt-2 text-[28px] leading-none font-extrabold tabular-nums" style={{ color: COR.texto }}>{reais(l.valor)}</p>

      {modo === "ver" && (
        <>
          <div>
            <LinhaValor rotulo="Categoria" valor={rotulo(l.categoria)} />
            <LinhaValor rotulo="No extrato" valor={l.original.length > 26 ? `${l.original.slice(0, 26)}…` : l.original} />
          </div>
          <div>
            <Acao icone={Tag} onClick={() => setModo("categoria")}>Alterar categoria</Acao>
            {l.categoria !== "transferencia_propria" && (
              <Acao icone={ArrowLeftRight} onClick={() => rodar({ tipo: "mover", id: l.id, categoria: "transferencia_propria", todos: false }, "Marcado como transferência entre suas contas")}>
                Marcar como transferência entre minhas contas
              </Acao>
            )}
            <Acao icone={EyeOff} onClick={() => rodar({ tipo: "fora", id: l.id, fora: !l.fora_analise }, l.fora_analise ? "Voltou pra análise" : "Fora da análise")}>
              {l.fora_analise ? "Voltar pra análise" : "Excluir da análise (reembolso, dinheiro de outra pessoa)"}
            </Acao>
            <Acao icone={Pencil} onClick={() => setModo("nome")}>Corrigir nome</Acao>
          </div>
        </>
      )}

      {modo === "categoria" && (
        <>
          <div className="flex flex-wrap gap-2">
            {(cats.data ?? []).filter((c) => c.slug !== l.categoria && c.slug !== "transferencia_propria").map((c) => (
              <Chip key={c.slug} ativo={nova === c.slug} onClick={() => setNova(c.slug)}>{c.rotulo}</Chip>
            ))}
          </div>
          {l.mesmo_nome > 1 && (
            <button type="button" role="switch" aria-checked={todos} onClick={() => { haptic(); setTodos((t) => !t); }}
              className="flex items-center gap-3 text-left min-h-11 text-[14px] font-semibold" style={{ color: COR.texto }}>
              <span className="w-6 h-6 rounded-[7px] border flex items-center justify-center shrink-0 transition-colors duration-100"
                style={todos ? { background: COR.ouro, borderColor: COR.ouro } : { borderColor: COR.borda }}>
                {todos && <Check className="w-4 h-4" strokeWidth={3} style={{ color: "#141005" }} />}
              </span>
              Aplicar a todos de {l.nome} ({l.mesmo_nome}) e aos próximos
            </button>
          )}
          <BotaoPrimario disabled={!nova} estado={acao.isPending ? "carregando" : "normal"}
            onClick={() => nova && rodar({ tipo: "mover", id: l.id, categoria: nova, todos }, todos ? `Movidos pra ${rotulo(nova)}` : `Movido pra ${rotulo(nova)}`)}>
            Salvar categoria
          </BotaoPrimario>
        </>
      )}

      {modo === "nome" && (
        <>
          <input value={nome} onChange={(e) => setNome(e.target.value.slice(0, 60))} aria-label="Nome" autoFocus
            className="h-12 rounded-[12px] border px-3 text-[16px] font-semibold outline-none focus:border-[#F5B800]"
            style={{ background: COR.surface2, borderColor: COR.borda, color: COR.texto }} />
          <BotaoPrimario disabled={!nome.trim()} estado={acao.isPending ? "carregando" : "normal"}
            onClick={() => rodar({ tipo: "renomear", id: l.id, nome }, "Nome corrigido")}>
            Salvar nome
          </BotaoPrimario>
        </>
      )}
    </Folha>
  );
}
