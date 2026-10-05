/* ============================================================
   RAIO-X DO EXTRATO (Rick, 29/09/2026) — /financas/extrato

   O vendedor manda o extrato dos bancos que usa (quantos quiser), a IA lê e
   categoriza, e esta tela mostra pra onde o dinheiro foi no mês, o que tá
   pesando e a divisão corre × pessoal. As visões ficam na URL (voltar funciona):
   resumo, enviar, categoria, não identificados, perguntas, entre contas, lançar na mão.
   ============================================================ */
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRaioXExtrato, useRaioXMeses } from "@/hooks/useRaioXExtrato";
import { useRaioXPerguntas, marcarContaUso } from "@/hooks/useRaioXInteligencia";
import RaioXResumo from "@/components/financas/raiox/RaioXResumo";
import RaioXEnviar from "@/components/financas/raiox/RaioXEnviar";
import RaioXLancamentos from "@/components/financas/raiox/RaioXLancamentos";
import RaioXPerguntas from "@/components/financas/raiox/RaioXPerguntas";
import RaioXEntreContas from "@/components/financas/raiox/RaioXEntreContas";
import RaioXManual from "@/components/financas/raiox/RaioXManual";
import { mesAtualIso, mesNome } from "@/components/financas/raiox/raiox-utils";

const MES_RE = /^\d{4}-\d{2}-01$/;

export default function RaioXExtrato() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const { meses, loading: carregandoMeses, reload: recarregarMeses } = useRaioXMeses(user?.id);

  // Mês: da URL; senão o mais recente com dados; senão o atual.
  const mesUrl = params.get("mes");
  const mes = useMemo(() => (mesUrl && MES_RE.test(mesUrl) ? mesUrl : (meses[0]?.mes ?? mesAtualIso())), [mesUrl, meses]);
  const view = params.get("v") ?? "";
  const { resumo, categorias, loading, reload, lista, mover, apagarArquivo } = useRaioXExtrato(user?.id, mes);
  const { perguntas, loading: carregandoPerguntas, reload: recarregarPerguntas, responder } = useRaioXPerguntas(user?.id);

  // Toda resposta/mudança refaz a análise no banco: recarrega resumo e perguntas.
  const responderEAtualizar = async (id: string, r: string, min?: number) => {
    const n = await responder(id, r, min);
    await Promise.all([reload(), recarregarMeses()]);
    return n;
  };
  const moverEAtualizar = async (id: string, categoria: string, soEste?: boolean) => {
    const n = await mover(id, categoria, soEste);
    await recarregarPerguntas();
    return n;
  };

  const ir = (v: string, extra?: Record<string, string>) => {
    const p = new URLSearchParams();
    p.set("mes", mes);
    if (v) p.set("v", v);
    for (const [k, val] of Object.entries(extra ?? {})) p.set(k, val);
    setParams(p);
  };

  // 04/10 (Mohamed): o Raio-X lê só os bancos ligados (Open Finance). Não cai mais
  // na tela de envio de PDF; o "vazio" do resumo leva pra ligar o banco.

  const voltar = () => {
    if (view) ir("");
    else navigate("/finances?aba=analise");
  };

  const catSlug = view.startsWith("cat:") ? view.slice(4) : null;
  const info = catSlug ? (resumo?.categorias.find((c) => c.categoria === catSlug) ?? null) : null;

  return (
    <div className="max-w-xl mx-auto pb-8 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={voltar} className="inline-flex items-center gap-0.5 text-[13px] font-bold h-9 -ml-1.5 pr-2" style={{ color: "#7e7869" }}>
          <ChevronLeft className="w-5 h-5" /> {view ? "Raio-X" : "Finanças"}
        </button>
        <span className="inline-flex items-center rounded-full px-2.5 py-1.5 text-[12px] font-extrabold" style={{ color: "#FFC800", background: "rgba(255,200,0,.1)", border: "1px solid rgba(255,200,0,.45)" }}>{mesNome(mes)}</span>
      </div>

      {view === "enviar" ? (
        <RaioXEnviar
          mes={meses.length > 0 ? mes : null}
          arquivos={resumo?.arquivos ?? []}
          onApagar={async (id) => { const ok = await apagarArquivo(id); await recarregarMeses(); return ok; }}
          onTerminou={async (tocados) => {
            await Promise.all([recarregarMeses(), recarregarPerguntas()]);
            const alvo = tocados[tocados.length - 1];
            if (alvo && MES_RE.test(alvo)) { const p = new URLSearchParams(); p.set("mes", alvo); setParams(p); }
            else if (tocados.length > 0) ir("");
          }}
        />
      ) : view === "perguntas" ? (
        <RaioXPerguntas perguntas={perguntas} loading={carregandoPerguntas} onResponder={responderEAtualizar} />
      ) : view === "entre" ? (
        <RaioXEntreContas mes={mes} lista={lista} mover={moverEAtualizar} />
      ) : view === "manual" ? (
        <RaioXManual categorias={categorias} bancos={resumo?.bancos ?? []}
          onSalvo={async (m) => { await recarregarMeses(); const p = new URLSearchParams(); p.set("mes", m); setParams(p); }} />
      ) : view === "nid" ? (
        <RaioXLancamentos mes={mes} categoria={null} info={null} categorias={categorias} lista={lista} mover={moverEAtualizar} />
      ) : catSlug ? (
        <RaioXLancamentos mes={mes} categoria={catSlug} info={info} categorias={categorias} lista={lista} mover={moverEAtualizar} />
      ) : (
        <RaioXResumo
          mes={mes} meses={meses} resumo={resumo} loading={loading || carregandoMeses}
          onMes={(m) => { const p = new URLSearchParams(); p.set("mes", m); setParams(p); }}
          onCategoria={(slug) => ir(`cat:${slug}`)}
          onNaoIdentificados={() => ir("nid")}
          onEnviar={() => navigate("/verificar")}
          onPerguntas={() => ir("perguntas")}
          onEntreContas={() => ir("entre")}
          onManual={() => ir("manual")}
          onContaUso={async (banco, uso) => { if (await marcarContaUso(banco, uso)) await reload(); }}
        />
      )}
    </div>
  );
}
