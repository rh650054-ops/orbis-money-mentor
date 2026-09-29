/* Raio-X do extrato — lista de lançamentos de uma categoria (ou dos não identificados).
   "Mover" troca a categoria de um lançamento e ensina a Vant: o mesmo comerciante
   vai pro lugar certo nas próximas leituras (RPC extrato_mover). */
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { RaioXLancamento, RaioXCategoriaDef, RaioXCategoria } from "@/hooks/useRaioXExtrato";
import { toast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";
import { diaCurto, moeda, mesNome, mesAnteriorIso, corCat } from "./raiox-utils";

interface Props {
  mes: string;
  /** slug da categoria; null = não identificados */
  categoria: string | null;
  info: RaioXCategoria | null;
  categorias: RaioXCategoriaDef[];
  lista: (categoria: string | null, tipo?: "saida" | "entrada") => Promise<RaioXLancamento[]>;
  mover: (id: string, categoria: string) => Promise<number>;
}

// Sugestões que aparecem primeiro no "mover" (as mais comuns pra vendedor de rua).
const ATALHOS = ["pix_pessoas", "mercadoria", "mercado", "insumos", "contas_casa", "parcelas", "transferencia_propria"];

export default function RaioXLancamentos({ mes, categoria, info, categorias, lista, mover }: Props) {
  const nid = categoria === null;
  const slug = categoria ?? "nao_identificado";
  const [itens, setItens] = useState<RaioXLancamento[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [todas, setTodas] = useState(false);
  const [filtro, setFiltro] = useState<string | null>(null);
  const [movendo, setMovendo] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setItens(null);
    lista(slug).then((r) => { if (vivo) setItens(r); });
    return () => { vivo = false; };
  }, [lista, slug]);

  const def = categorias.find((c) => c.slug === slug);
  const saidas = useMemo(() => categorias.filter((c) => c.tipo === "saida" && c.slug !== "nao_identificado" && c.slug !== slug), [categorias, slug]);
  const chips = todas ? saidas : [...ATALHOS.map((s) => saidas.find((c) => c.slug === s)).filter((c): c is RaioXCategoriaDef => !!c)];

  // Filtro por comerciante (top 4) — só quando tem mais de um.
  const comerciantes = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of itens ?? []) if (l.comerciante) m.set(l.comerciante, (m.get(l.comerciante) ?? 0) + 1);
    return [...m.entries()].filter(([, q]) => q > 1).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);
  }, [itens]);
  const visiveis = (itens ?? []).filter((l) => !filtro || l.comerciante === filtro);
  const bonito = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());

  const handleMover = async (l: RaioXLancamento, destino: RaioXCategoriaDef) => {
    setMovendo(l.id);
    const n = await mover(l.id, destino.slug);
    setMovendo(null);
    setAberto(null);
    if (n > 0) {
      setItens((prev) => (prev ?? []).filter((x) => x.id !== l.id && !(n > 1 && x.comerciante && x.comerciante === l.comerciante)));
      toast({ title: `Movido pra ${destino.rotulo}`, description: n > 1 ? `${n} lançamentos de ${bonito(l.comerciante ?? "")} foram juntos. Da próxima vez já vai direto.` : "Da próxima vez esse nome já vai direto pra lá." });
    } else {
      toast({ title: "Não consegui mover", description: "Tenta de novo em instantes." });
    }
  };

  const cor = corCat(slug);
  const antNome = mesNome(mesAnteriorIso(mes));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-[24px] shrink-0" style={{ background: `${cor}22` }}>{def?.icone ?? "❓"}</span>
        <div className="min-w-0">
          <h1 className="text-[20px] font-black tracking-tight text-foreground leading-tight">{nid ? "Me ajuda com esses?" : def?.rotulo ?? slug}</h1>
          <p className="text-[11.5px] leading-snug" style={{ color: "#7e7869" }}>
            {nid ? "Não tive certeza do que são. Toca no tipo certo — só uma vez, depois eu lembro."
              : info ? `${info.qtd} ${info.qtd === 1 ? "lançamento" : "lançamentos"}${info.qtd > 1 ? ` · ${moeda(info.total / info.qtd)} cada em média` : ""}` : mesNome(mes)}
          </p>
        </div>
      </div>

      {!nid && info && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border p-3" style={{ background: "#131211", borderColor: "rgba(255,255,255,.07)" }}>
            <span className="orbis-section">{mesNome(mes)}</span>
            <div className="text-[22px] font-black tracking-tight tabular-nums mt-1.5" style={{ color: "#FF5A45" }}>{moeda(info.total)}</div>
            <small className="block text-[11px] font-semibold mt-1" style={{ color: "#7e7869" }}>
              {info.anterior > 0 ? `${info.total >= info.anterior ? "▲" : "▼"} ${moeda(Math.abs(info.total - info.anterior))} vs ${antNome}` : `${info.pct}% do que saiu`}
            </small>
          </div>
          <div className="rounded-2xl border p-3" style={{ background: "#131211", borderColor: "rgba(255,255,255,.07)" }}>
            <span className="orbis-section">Onde mais</span>
            <div className="text-[16px] font-black tracking-tight mt-2 text-foreground truncate">{comerciantes[0] ? bonito(comerciantes[0]) : "—"}</div>
            <small className="block text-[11px] font-semibold mt-1" style={{ color: "#7e7869" }}>
              {comerciantes[0] ? `${(itens ?? []).filter((l) => l.comerciante === comerciantes[0]).length} de ${itens?.length ?? 0}` : "cada um num lugar"}
            </small>
          </div>
        </div>
      )}

      {comerciantes.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {[null, ...comerciantes].map((c) => (
            <button key={c ?? "todos"} type="button" onClick={() => setFiltro(c)} className="rounded-full px-2.5 py-1.5 text-[11.5px] font-bold border"
              style={filtro === c ? { background: "#FFC800", color: "#1A1200", borderColor: "transparent" } : { background: "#171716", color: "#b9b3a6", borderColor: "rgba(255,255,255,.08)" }}>
              {c ? bonito(c) : "Todos"}
            </button>
          ))}
        </div>
      )}

      <section className="rounded-2xl border px-3.5" style={{ background: "#131211", borderColor: "rgba(255,255,255,.07)" }}>
        {itens === null ? (
          <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#FFC800" }} /></div>
        ) : visiveis.length === 0 ? (
          <p className="py-4 text-[12.5px]" style={{ color: "#a9a49c" }}>{nid ? "Tudo identificado. 👊" : "Nada aqui nesse mês."}</p>
        ) : visiveis.map((l, i) => {
          const d = diaCurto(l.data);
          const abertoAqui = aberto === l.id;
          return (
            <div key={l.id} style={{ borderTop: i ? "1px solid rgba(255,255,255,.07)" : undefined }}>
              <div className="flex items-center gap-2.5 py-2.5">
                <span className="w-[34px] text-center leading-tight shrink-0">
                  <b className="block text-[14px] text-foreground">{d.dia}</b>
                  <span className="block text-[10.5px] font-extrabold" style={{ color: "#7e7869" }}>{d.sem}</span>
                </span>
                <div className="flex-1 min-w-0">
                  <b className="block text-[13px] text-foreground leading-snug" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{l.descricao}</b>
                  <span className="text-[11px] font-semibold" style={{ color: "#7e7869" }}>{[l.hora, l.banco].filter(Boolean).join(" · ") || "—"}</span>
                </div>
                <span className="text-[14px] font-black tabular-nums text-foreground">{formatCurrency(l.valor)}</span>
                <button type="button" onClick={() => setAberto(abertoAqui ? null : l.id)} className="text-[10px] font-extrabold rounded-lg px-1.5 py-1 border shrink-0"
                  style={{ color: abertoAqui || nid ? "#FFC800" : "#5c574d", borderColor: abertoAqui || nid ? "rgba(255,200,0,.45)" : "rgba(255,255,255,.08)" }}>
                  {nid ? "é o quê?" : "mover"}
                </button>
              </div>
              {abertoAqui && (
                <div className="flex gap-1.5 flex-wrap pb-3">
                  {chips.map((c) => (
                    <button key={c.slug} type="button" disabled={movendo !== null} onClick={() => handleMover(l, c)}
                      className="rounded-full px-2.5 py-1.5 text-[11.5px] font-bold border disabled:opacity-60" style={{ background: "#171716", color: "#e8e3d8", borderColor: "rgba(255,255,255,.1)" }}>
                      {movendo === l.id ? "…" : `${c.icone} ${c.rotulo}`}
                    </button>
                  ))}
                  {!todas && <button type="button" onClick={() => setTodas(true)} className="rounded-full px-2.5 py-1.5 text-[11.5px] font-bold border" style={{ background: "transparent", color: "#7e7869", borderColor: "rgba(255,255,255,.08)" }}>outro…</button>}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {!nid && <p className="text-[11.5px] leading-snug px-0.5" style={{ color: "#7e7869" }}>"Mover" manda o lançamento pra outra categoria — e a Vant aprende: da próxima vez esse nome já vai pro lugar certo.</p>}
    </div>
  );
}
