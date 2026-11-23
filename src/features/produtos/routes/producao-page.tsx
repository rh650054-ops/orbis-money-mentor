/* /products/produzir — "Produzi" for several products and flavours at once (23/11/2026). The seller
   says how many of each were made; the database takes the right ingredients by each flavour's recipe
   and yield (producao_registrar), refuses what the stock cannot cover and keeps the history. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { useCatalogoProducaoQuery } from "../api/use-catalogo-producao-query";
import { useProducaoRecentesQuery, useSimularProducaoQuery, type ItemEnvio } from "../api/use-producao-query";
import { useRegistrarProducaoMutation } from "../api/use-producao-escrita";
import { useEnvioPendente } from "../hooks/use-envio-pendente";
import { chaveItem, itensDeProducao, itensParaEnviar, mensagemDaProducao, novaChave, pedeMotivo } from "../lib/producao";
import { VANT } from "../lib/visual";
import { CarregandoProdutos } from "../components/carregando-produtos";
import { MercadoCasca } from "../components/mercado-casca";
import { ProducaoItem } from "../components/producao-item";
import { ProducaoMotivo } from "../components/producao-motivo";
import { ProducaoPrevia } from "../components/producao-previa";
import { ProducaoRecentes } from "../components/producao-recentes";
import { BotaoOuro } from "../components/quiz-casca";

function useAtrasado<T>(v: T, ms = 400): T {
  const [x, setX] = useState(v);
  useEffect(() => { const t = window.setTimeout(() => setX(v), ms); return () => window.clearTimeout(t); }, [v, ms]);
  return x;
}

export default function ProducaoPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const primeiro = useMemo(() => new Set((params.get("p") ?? "").split(",").filter(Boolean)), [params]);
  const { user } = useAuth();
  const catalogo = useCatalogoProducaoQuery(user?.id);
  const recentes = useProducaoRecentesQuery(user?.id);
  const registrar = useRegistrarProducaoMutation();
  const { pendente, guardar, limpar } = useEnvioPendente(user?.id);
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [justificativa, setJustificativa] = useState<string | null>(null);
  const [pedindoMotivo, setPedindoMotivo] = useState(false);
  const itens = useMemo(() => itensParaEnviar(qtd), [qtd]);
  const itensSim = useAtrasado(itens);
  const sim = useSimularProducaoQuery(itensSim, justificativa);
  const erroSim = sim.error ? mensagemDaProducao(sim.error) : null;

  const grupos = useMemo(() => {
    const g = catalogo.data ? itensDeProducao(catalogo.data) : [];
    return [...g].sort((a, b) => Number(primeiro.has(b.produto.id)) - Number(primeiro.has(a.produto.id)));
  }, [catalogo.data, primeiro]);

  const enviar = (lista: ItemEnvio[], just: string | null, chave: string) => {
    guardar({ chave, itens: lista, justificativa: just, quando: new Date().toISOString() });
    registrar.mutate({ chave, itens: lista, justificativa: just }, {
      onSuccess: (r) => {
        limpar(); setQtd({}); setJustificativa(null); setPedindoMotivo(false);
        const total = r.itens.reduce((s, i) => s + i.unidades, 0);
        toast({ title: r.repetido ? "Essa produção já estava registrada" : `Produção registrada: +${total}`, description: "Ingredientes baixados pela receita de cada sabor." });
      },
      onError: (e) => {
        const m = mensagemDaProducao(e);
        if (m.codigo === "SEM_REDE") { toast({ title: "Sem conexão", description: m.texto, variant: "destructive" }); return; }
        limpar();  // refused: nothing was applied, the next try is a new submission
        if (pedeMotivo(m.codigo)) { setPedindoMotivo(true); return; }
        toast({ title: "Não registrei", description: m.texto, variant: "destructive" });
      },
    });
  };

  if (catalogo.isLoading) return <CarregandoProdutos />;
  if (catalogo.isError) {
    return (
      <div className="min-h-[100dvh] bg-black text-[#F4F1EA] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-bold">Não consegui abrir a produção.</p>
        <button type="button" onClick={() => catalogo.refetch()} className="underline font-extrabold" style={{ color: VANT.ouro }}>Tentar de novo</button>
      </div>
    );
  }
  const temFalta = (sim.data?.faltas.length ?? 0) > 0;
  const pronto = itens.length > 0 && !registrar.isPending && !temFalta && !(erroSim && !pedeMotivo(erroSim.codigo));

  return (
    <MercadoCasca titulo="Produzir" sub="Diga quantas fez de cada um. A VANT baixa os ingredientes da receita de cada sabor." onVoltar={() => navigate("/products")}
      rodape={<BotaoOuro disabled={!pronto} onClick={() => (erroSim && pedeMotivo(erroSim.codigo) ? setPedindoMotivo(true) : enviar(itens, justificativa, novaChave()))}>
        {registrar.isPending ? "REGISTRANDO…" : "REGISTRAR PRODUÇÃO"}</BotaoOuro>}>
      {pendente && (
        <div className="rounded-[14px] px-3 py-2.5 flex flex-col gap-1.5" style={{ background: "rgba(245,184,0,.08)", border: `1px solid ${VANT.ouro}` }}>
          <span className="text-[13px] font-black">Uma produção ficou sem confirmação.</span>
          <span className="text-[12px] font-bold" style={{ color: VANT.cinza }}>Reenviar é seguro: se ela já entrou, a VANT não conta de novo.</span>
          <span className="flex gap-4 text-[13px] font-black">
            <button type="button" style={{ color: VANT.ouro }} disabled={registrar.isPending} onClick={() => enviar(pendente.itens, pendente.justificativa, pendente.chave)}>Reenviar</button>
            <button type="button" style={{ color: VANT.cinza }} onClick={limpar}>Descartar</button>
          </span>
        </div>
      )}
      {grupos.length === 0 && <p className="text-[14px] font-bold" style={{ color: VANT.cinza }}>Nenhum produto feito por você ainda. Cadastre um produto com receita para produzir.</p>}
      {grupos.map((g) => (
        <section key={g.produto.id} className="flex flex-col gap-1.5">
          {g.itens.length > 1 || g.itens[0]?.sabor ? <span className="text-[13px] font-black mt-1">{g.produto.emoji ?? "📦"} {g.produto.name}</span> : null}
          {g.itens.map((it) => {
            const k = chaveItem(it.produto.id, it.sabor?.id ?? null);
            return <ProducaoItem key={k} item={it} valor={qtd[k] ?? 0} onMudar={(n) => setQtd((q) => ({ ...q, [k]: n }))} />;
          })}
        </section>
      ))}
      <ProducaoPrevia sim={sim.data} carregando={sim.isFetching} erro={erroSim && !pedeMotivo(erroSim.codigo) ? erroSim.texto : null} />
      <ProducaoRecentes lista={recentes.data ?? []} />
      <ProducaoMotivo key={pedindoMotivo ? "aberto" : "fechado"} aberto={pedindoMotivo} titulo="A receita mudou" botao="REGISTRAR" enviando={registrar.isPending}
        explicacao={erroSim?.texto ?? "A receita foi alterada para gastar menos desde a última produção. Explique o motivo uma vez."}
        onFechar={() => setPedindoMotivo(false)}
        onEnviar={(m) => { setJustificativa(m); enviar(itens, m, novaChave()); }} />
    </MercadoCasca>
  );
}
