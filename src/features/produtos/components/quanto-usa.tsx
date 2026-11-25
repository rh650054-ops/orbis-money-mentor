/* "Quanto uso?" of a recipe line (25/11/2026, Rick): he chooses HOW he tells it and the VANT only asks
   what it really needs. Four compact choices — Inteira, Metade, Informar, Não sei:
   · Inteira / Metade use one package as it is bought (no weight asked: half a R$ 3,79 box = R$ 1,90);
   · Informar: [200] [g] in any compatible measure; a box used in g asks once "quanto vem em cada
     caixinha?" and keeps the answer for every recipe;
   · Não sei keeps the line pending (no stock leaves it, the cost is partial).
   The line is always stored in the ingredient's own unit, so stock and production never mix units. */
import { useState } from "react";
import { atalhoDoUso, tamanhoEmbalagem, usoDoAtalho, type AtalhoUso, type IngredienteRascunho } from "../lib/receitas";
import { nomeDaUnidade, paraBase, unidadesDeUso, type UnidadeUso } from "../lib/medidas";
import { fmt } from "../lib/formato";
import { MiniNumero } from "./mini-campos";

const OPCOES: [AtalhoUso, string][] = [["inteira", "Inteira"], ["metade", "Metade"], ["informar", "Informar"], ["naosei", "Não sei"]];
const SEL = "h-9 rounded-[10px] bg-[#1a1a19] px-2 outline-none text-sm font-black text-[#F4F1EA]";

export function QuantoUsa({ it, porUnidade, medidas, onMudar }: {
  it: IngredienteRascunho; porUnidade: boolean;
  /** the database remembers package contents (migration 20261125200000): box ↔ g/ml is offered */
  medidas: boolean;
  onMudar: (m: Partial<IngredienteRascunho>) => void;
}) {
  const [modo, setModo] = useState<AtalhoUso>(() => (it.qtd > 0 || it.aprender || it.uso ? atalhoDoUso(it) : "informar"));
  const ativo: AtalhoUso = it.aprender ? "naosei" : modo === "naosei" ? "informar" : modo;
  const base = it.unidade as UnidadeUso;
  const unidadeTela: UnidadeUso = it.uso?.unidade ?? base;
  const valorTela = it.uso ? it.uso.qtd : it.qtd;
  const nome = nomeDaUnidade("un", it.embalagem) === "un" ? "unidade" : nomeDaUnidade("un", it.embalagem);
  // without the migration a box is only used by the box (the content could not be remembered)
  const unidades = unidadesDeUso(it.unidade).filter((u) => medidas || u === base || (base !== "un" && u !== "un"));
  const conv = it.uso ? paraBase(it.uso.qtd, it.uso.unidade, it.unidade, it.conteudo) : null;
  // a box used in g/ml: the content question stays open while he types it (and can be reopened)
  const [editarConteudo, setEditarConteudo] = useState(false);
  const dimUso = it.uso && base === "un" && it.uso.unidade !== "un" ? (it.uso.unidade === "g" || it.uso.unidade === "kg" ? "g" : "ml") : null;
  // a box already told in g is never asked in ml: that is not a conversion, it is refused below
  const pedirConteudo = ativo === "informar" && dimUso !== null && (!it.conteudo || (editarConteudo && it.conteudo.unidade === dimUso));
  const aplicar = (v: number, u: UnidadeUso, conteudo = it.conteudo) => {
    if (u === base) return onMudar({ qtd: v, uso: undefined, aprender: false });
    const c = paraBase(v, u, it.unidade, conteudo);
    onMudar({ uso: { qtd: v, unidade: u }, qtd: c.ok ? c.qtd : 0, aprender: false, ...(conteudo !== it.conteudo ? { conteudo } : {}) });
  };
  const pac = tamanhoEmbalagem(it);
  const embTxt = it.unidade === "un" && it.embalagem ? `1 ${it.embalagem}` : `${fmt(pac)} ${nomeDaUnidade(base)}`;
  return (
    <div className="flex flex-col gap-1.5 pl-[30px] text-[12px] font-bold" style={{ color: "#b9b3a6" }}>
      <span className="text-[12px] font-extrabold">Quanto uso?</span>
      {/* one segmented row, fits 360 px: no stack of big buttons */}
      <div className="grid grid-cols-4 gap-0.5 rounded-full p-0.5" role="group" aria-label="Quanto usa" style={{ background: "#1a1a19", border: "1px solid #2c2a25" }}>
        {OPCOES.map(([a, r]) => (
          <button key={a} type="button" aria-pressed={ativo === a} onClick={() => { setModo(a); onMudar(usoDoAtalho(a, it)); }}
            className="rounded-full h-8 text-[11.5px] font-extrabold whitespace-nowrap" style={ativo === a ? { background: "#F5B800", color: "#1A1200" } : { color: "#d8d2c4" }}>{r}</button>
        ))}
      </div>
      {(ativo === "inteira" || ativo === "metade") && <span className="text-[11px]">{ativo === "inteira" ? embTxt : `metade de ${embTxt}`} {porUnidade ? "em cada unidade" : "na receita"} · sem precisar do peso</span>}
      {ativo === "informar" && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <MiniNumero valor={valorTela} exemplo="?" rotulo="Quanto usa na leva" onChange={(v) => aplicar(v, unidadeTela)} />
          {unidades.length > 1
            ? <select value={unidadeTela} aria-label="Unidade do que usa" onChange={(e) => { setEditarConteudo(false); aplicar(valorTela, e.target.value as UnidadeUso); }} className={SEL}>
                {unidades.map((u) => <option key={u} value={u}>{nomeDaUnidade(u, it.embalagem)}</option>)}
              </select>
            : <span>{nomeDaUnidade(unidadeTela, it.embalagem)}</span>}
          <span className="whitespace-nowrap">{porUnidade ? "por unidade" : "na receita"}</span>
        </div>
      )}
      {pedirConteudo && dimUso && (
        <div onBlur={() => setEditarConteudo(false)} className="flex items-center gap-1.5 flex-wrap rounded-[12px] px-2.5 py-2" style={{ background: "#1a1305", border: "1px solid rgba(245,184,0,.4)" }}>
          <span className="font-extrabold" style={{ color: "#F5B800" }}>Quanto vem em cada {nome}?</span>
          <MiniNumero valor={it.conteudo?.unidade === dimUso ? it.conteudo.qtd : 0} exemplo="?" rotulo={`Quanto vem em cada ${nome}`}
            onChange={(c) => { setEditarConteudo(true); if (c > 0 && it.uso) aplicar(it.uso.qtd, it.uso.unidade, { qtd: c, unidade: dimUso }); }} />
          <span>{dimUso}</span>
          <span className="w-full text-[10.5px]" style={{ color: "#8A8A8A" }}>Só uma vez: as outras receitas usam esse número. Sem ele, fica pendente.</span>
        </div>
      )}
      {ativo === "informar" && !pedirConteudo && conv && !conv.ok && conv.motivo === "incompativel" && (
        <span className="text-[11px] font-extrabold" style={{ color: "#FF9A3D" }}>
          {it.conteudo ? `Cada ${nome} está em ${it.conteudo.unidade} (${fmt(it.conteudo.qtd)} ${it.conteudo.unidade}): g e ml não se convertem.` : "Essa medida não converte para a da compra."} Use outra unidade.
        </span>
      )}
      {ativo === "informar" && !pedirConteudo && conv?.ok && it.conteudo && (
        <span className="text-[10.5px]" style={{ color: "#8A8A8A" }}>
          cada {nome} tem {fmt(it.conteudo.qtd)} {it.conteudo.unidade} · sai {fmt(Math.round(conv.qtd * 1000) / 1000)} {nome} do estoque ·{" "}
          <button type="button" onClick={() => setEditarConteudo(true)} className="underline underline-offset-2 font-extrabold" style={{ color: "#F5B800" }}>mudar</button>
        </span>
      )}
      {ativo === "naosei" && <span className="text-[11px] leading-snug">Fica pendente. Enquanto estiver assim, ele não sai do estoque na produção e o custo fica parcial. Você completa depois.</span>}
    </div>
  );
}
