/* ============================================================
   CUSTO DO PRODUTO PELAS NOTAS (05/10/2026, pedido do Rick).
   "Tiro foto da nota do Atacadão, falo que vou fazer 100 batidas com essa
   mercadoria, mostro a nota do outro lugar também… e no final você me passa o
   custo certinho do produto."
   Passo a passo em tom de conversa:
   1) qual produto e quantas unidades a mercadoria rende;
   2) foto de cada nota → a IA lê (nota-ler) → ele tira o que não foi mercadoria
      e diz como pagou (dinheiro, cartão, Pix ou dividido) → "tem mais alguma nota?";
   3) custo por unidade = soma ÷ rendimento → salvar (custo_notas_salvar): custo no
      produto, estoque, custo do dia e a saída do banco marcada como Mercadoria.
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { avisar } from "@/shared/lib/avisar";
import { formatCurrency } from "@/shared/lib/utils";
import {
  comprimirFoto, notaDaApi, partesDaNota, reaisParaNumero, resumoCusto, valorMercadoria,
  type NotaApi, type NotaLida, type Pagamento,
} from "@/components/custo/custo-lib";

const GOLD = "#F5B800";
const MUTE = "#8a857c";
const CARD = { background: "#0f0f10", border: "1px solid #1f1e22" };
const sb = supabase as any;

interface Produto { id: string; name: string; cost: number | null; sale_price: number | null }
type Etapa = "produto" | "notas" | "resultado";

const ERROS: Record<string, string> = {
  ilegivel: "Não consegui ler essa foto. Tira de novo com a nota esticada e bem iluminada — ou digita o valor.",
  limite_diario: "Você já leu muitas notas hoje. Amanhã libera de novo — ou digita o valor dessa.",
  imagem_grande: "Foto grande demais. Tenta de novo.",
};

function Fala({ children }: { children: React.ReactNode }) {
  return <p className="text-[14.5px] font-extrabold leading-snug">{children}</p>;
}

export default function CustoProduto() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState<Etapa>("produto");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [rendimento, setRendimento] = useState("");
  const [notas, setNotas] = useState<NotaLida[]>([]);
  const [lendo, setLendo] = useState(false);
  const [manual, setManual] = useState<{ loja: string; valor: string } | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState<{ custo_unidade: number; conciliados: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    sb.from("products").select("id,name,cost,sale_price").eq("user_id", user.id).eq("is_active", true).order("name")
      .then(({ data, error }: { data: Produto[] | null; error: unknown }) => {
        if (error) avisar.erro("Custo: produtos", error);
        setProdutos(data ?? []);
      });
  }, [user?.id]);

  const produto = produtos.find((p) => p.id === produtoId) ?? null;
  const nomeProduto = produto?.name ?? novoNome.trim();
  const rend = reaisParaNumero(rendimento);
  const res = resumoCusto(notas, rend, Number(produto?.sale_price) || 0);

  const lerFoto = async (file: File) => {
    setLendo(true);
    try {
      const dataUrl = await comprimirFoto(file);
      const { data, error } = await supabase.functions.invoke("nota-ler", { body: { imagem_b64: dataUrl, mime: "image/jpeg" } });
      if (error) throw error;
      const d = data as NotaApi & { error?: string };
      if (d?.error) {
        toast({ title: "Não deu pra ler", description: ERROS[d.error] ?? "Tenta de novo em instantes — ou digita o valor.", variant: "destructive" });
        setManual({ loja: "", valor: "" });
        return;
      }
      const nota = notaDaApi(d, crypto.randomUUID());
      setNotas((ns) => [...ns, nota]);
      setAberta(nota.id);
    } catch (e) {
      avisar.erro("Custo: ler nota", e);
      toast({ title: "Não consegui ler a nota", description: "Confere a internet e tenta de novo — ou digita o valor.", variant: "destructive" });
      setManual({ loja: "", valor: "" });
    } finally {
      setLendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addManual = () => {
    const v = reaisParaNumero(manual?.valor ?? "");
    if (v <= 0) return;
    const id = crypto.randomUUID();
    setNotas((ns) => [...ns, { id, loja: manual?.loja.trim() || "Nota", data: null, total: v, itens: [], pagamento: "cartao", dinheiro: "" }]);
    setManual(null);
    setAberta(id);
  };

  const mudar = (id: string, f: (n: NotaLida) => NotaLida) => setNotas((ns) => ns.map((n) => (n.id === id ? f(n) : n)));

  const salvar = async () => {
    setSalvando(true);
    try {
      const payload = notas.map((n) => ({ loja: n.loja, data: n.data, partes: partesDaNota(n) })).filter((n) => n.partes.length);
      const { data, error } = await sb.rpc("custo_notas_salvar", {
        p_product_id: produtoId, p_nome: produtoId ? null : novoNome.trim(), p_rendimento: rend, p_notas: payload,
      });
      if (error) throw error;
      setSalvo({ custo_unidade: Number(data?.custo_unidade) || res.unidade, conciliados: Number(data?.conciliados) || 0 });
      toast({ title: "Custo salvo", description: `${nomeProduto}: ${formatCurrency(Number(data?.custo_unidade) || res.unidade)} por unidade.` });
    } catch (e) {
      avisar.usuario("Não consegui salvar o custo. Tenta de novo.", e, "Custo: salvar");
    } finally {
      setSalvando(false);
    }
  };

  const podeSeguir = !!nomeProduto && rend > 0;

  return (
    <div className="min-h-screen px-4 pt-4 pb-28 max-w-2xl mx-auto space-y-3" style={{ background: "#000" }}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => (etapa === "produto" ? navigate(-1) : setEtapa(etapa === "resultado" ? "notas" : "produto"))}
          aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#b9b3a6" }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="font-mono text-[10px] font-bold tracking-[.18em]" style={{ color: MUTE }}>CUSTO DO PRODUTO</p>
        <span className="w-9" />
      </div>

      {/* 1) produto + rendimento */}
      <section className="rounded-2xl p-4 space-y-3" style={CARD}>
        <Fala>Bora descobrir quanto custa cada unidade. Qual produto você vai fazer com essa mercadoria?</Fala>
        <div className="flex flex-wrap gap-1.5">
          {produtos.map((p) => (
            <button key={p.id} type="button" onClick={() => { setProdutoId(p.id); setNovoNome(""); }}
              className="rounded-full px-3 py-1.5 text-[12.5px] font-bold border"
              style={produtoId === p.id ? { background: "rgba(245,184,0,.14)", borderColor: GOLD, color: GOLD } : { borderColor: "#2a2a2e", color: "#e8e3d8" }}>
              {p.name}
            </button>
          ))}
        </div>
        <input value={novoNome} onChange={(e) => { setNovoNome(e.target.value.slice(0, 80)); setProdutoId(null); }}
          placeholder={produtos.length ? "ou escreve um produto novo" : "ex.: Batida de maracujá"}
          className="w-full h-11 rounded-xl px-3 bg-transparent text-[14px] outline-none" style={{ border: "1px solid #2a2a2e" }} />
        {nomeProduto && (
          <>
            <Fala>Quantas unidades de {nomeProduto} essa mercadoria vai render?</Fala>
            <div className="flex items-center gap-2">
              <input inputMode="numeric" value={rendimento} onChange={(e) => setRendimento(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                placeholder="100" aria-label="Rendimento em unidades"
                className="w-28 h-11 rounded-xl px-3 bg-transparent text-[18px] font-black tabular-nums outline-none" style={{ border: `1px solid ${rend > 0 ? GOLD : "#2a2a2e"}` }} />
              <span className="text-[13px] font-bold" style={{ color: MUTE }}>unidades</span>
            </div>
          </>
        )}
        {etapa === "produto" && (
          <button type="button" disabled={!podeSeguir} onClick={() => setEtapa("notas")}
            className="w-full h-12 rounded-2xl text-[14px] font-black disabled:opacity-40"
            style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
            SEGUIR PRAS NOTAS
          </button>
        )}
      </section>

      {/* 2) notas */}
      {etapa !== "produto" && (
        <section className="rounded-2xl p-4 space-y-3" style={CARD}>
          <Fala>{notas.length === 0 ? "Agora tira uma foto da nota fiscal da compra." : "Tem mais alguma nota dessa mercadoria?"}</Fala>
          {notas.map((n) => {
            const merc = valorMercadoria(n);
            const abertaAqui = aberta === n.id;
            return (
              <div key={n.id} className="rounded-xl p-3" style={{ background: "#141416", border: "1px solid #232327" }}>
                <button type="button" onClick={() => setAberta(abertaAqui ? null : n.id)} className="w-full flex items-center gap-2 text-left">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-extrabold truncate">{n.loja}</span>
                    <span className="block text-[11px]" style={{ color: MUTE }}>
                      {n.data ? new Date(`${n.data}T12:00:00`).toLocaleDateString("pt-BR") : "sem data"} · nota de {formatCurrency(n.total)}
                    </span>
                  </span>
                  <span className="text-[14px] font-black tabular-nums" style={{ color: GOLD }}>{formatCurrency(merc)}</span>
                </button>
                {abertaAqui && (
                  <div className="mt-2 space-y-2.5">
                    {n.itens.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold mb-1" style={{ color: MUTE }}>Desmarca o que não foi mercadoria (coisa da casa):</p>
                        <div className="max-h-56 overflow-y-auto">
                          {n.itens.map((it, idx) => (
                            <label key={idx} className="flex items-center gap-2 py-1.5 text-[12.5px]" style={{ borderTop: idx ? "1px solid rgba(255,255,255,.05)" : undefined }}>
                              <input type="checkbox" checked={it.on} className="w-4 h-4 accent-[#FFC800]"
                                onChange={(e) => mudar(n.id, (x) => ({ ...x, itens: x.itens.map((y, j) => (j === idx ? { ...y, on: e.target.checked } : y)) }))} />
                              <span className="flex-1 min-w-0 truncate" style={{ color: it.on ? "#e8e3d8" : "#5c574d" }}>{it.qtd > 1 ? `${it.qtd}× ` : ""}{it.descricao}</span>
                              <span className="tabular-nums font-bold" style={{ color: it.on ? "#e8e3d8" : "#5c574d" }}>{formatCurrency(it.valor)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-[11px] font-bold" style={{ color: MUTE }}>Como você pagou essa?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(["dinheiro", "cartao", "pix", "dividido"] as Pagamento[]).map((p) => (
                        <button key={p} type="button" onClick={() => mudar(n.id, (x) => ({ ...x, pagamento: p }))}
                          className="rounded-full px-3 py-1.5 text-[12px] font-bold border"
                          style={n.pagamento === p ? { background: "rgba(245,184,0,.14)", borderColor: GOLD, color: GOLD } : { borderColor: "#2a2a2e", color: "#e8e3d8" }}>
                          {{ dinheiro: "Dinheiro", cartao: "Cartão", pix: "Pix", dividido: "Parte dinheiro, parte cartão" }[p]}
                        </button>
                      ))}
                    </div>
                    {n.pagamento === "dividido" && (
                      <label className="flex items-center gap-2 text-[12.5px]">
                        <span style={{ color: MUTE }}>Em dinheiro: R$</span>
                        <input inputMode="decimal" value={n.dinheiro} onChange={(e) => mudar(n.id, (x) => ({ ...x, dinheiro: e.target.value.replace(/[^\d,]/g, "").slice(0, 9) }))}
                          className="w-24 h-9 rounded-lg px-2 bg-transparent font-black tabular-nums outline-none" style={{ border: "1px solid #2a2a2e" }} />
                        <span style={{ color: MUTE }}>o resto no cartão</span>
                      </label>
                    )}
                    <button type="button" onClick={() => setNotas((ns) => ns.filter((x) => x.id !== n.id))}
                      className="inline-flex items-center gap-1 text-[11.5px] font-bold" style={{ color: "#ff8a7a" }}>
                      <Trash2 className="w-3.5 h-3.5" /> tirar essa nota
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {manual && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: "#141416", border: "1px solid #232327" }}>
              <p className="text-[12px] font-bold" style={{ color: MUTE }}>Digita a nota:</p>
              <input value={manual.loja} onChange={(e) => setManual({ ...manual, loja: e.target.value.slice(0, 60) })} placeholder="Onde comprou (ex.: Atacadão)"
                className="w-full h-10 rounded-lg px-3 bg-transparent text-[13px] outline-none" style={{ border: "1px solid #2a2a2e" }} />
              <div className="flex gap-2">
                <input inputMode="decimal" value={manual.valor} onChange={(e) => setManual({ ...manual, valor: e.target.value.replace(/[^\d,]/g, "").slice(0, 10) })} placeholder="Valor (R$)"
                  className="flex-1 h-10 rounded-lg px-3 bg-transparent text-[13px] font-black outline-none" style={{ border: "1px solid #2a2a2e" }} />
                <button type="button" onClick={addManual} className="h-10 px-4 rounded-lg text-[12.5px] font-black" style={{ background: GOLD, color: "#1A1200" }}>Pôr</button>
              </div>
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void lerFoto(f); }} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={lendo} onClick={() => fileRef.current?.click()}
              className="h-12 rounded-xl inline-flex items-center justify-center gap-2 text-[13px] font-black disabled:opacity-60"
              style={{ border: `1px solid ${GOLD}`, color: GOLD, background: "rgba(245,184,0,.06)" }}>
              {lendo ? <><Loader2 className="w-4 h-4 animate-spin" /> Lendo a nota…</> : <><Camera className="w-4 h-4" /> {notas.length ? "Mais uma nota" : "Foto da nota"}</>}
            </button>
            <button type="button" onClick={() => setManual(manual ? null : { loja: "", valor: "" })}
              className="h-12 rounded-xl inline-flex items-center justify-center gap-2 text-[13px] font-bold" style={{ border: "1px solid #2a2a2e", color: "#b9b3a6" }}>
              <Plus className="w-4 h-4" /> Digitar valor
            </button>
          </div>
          {notas.length > 0 && etapa === "notas" && (
            <button type="button" onClick={() => setEtapa("resultado")} disabled={res.total <= 0}
              className="w-full h-12 rounded-2xl text-[14px] font-black disabled:opacity-40"
              style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
              SÃO TODAS · VER O CUSTO
            </button>
          )}
        </section>
      )}

      {/* 3) resultado */}
      {etapa === "resultado" && (
        <section className="rounded-2xl p-4 space-y-2" style={{ background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)", border: "1px solid rgba(245,184,0,.42)" }}>
          <p className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>CUSTO DE CADA {nomeProduto.toUpperCase()}</p>
          <p className="text-[38px] font-black tabular-nums leading-none">{formatCurrency(res.unidade)}</p>
          <p className="text-[12.5px]" style={{ color: "#b9b3a6" }}>
            {formatCurrency(res.total)} de mercadoria em {notas.length} {notas.length === 1 ? "nota" : "notas"} ÷ {rend} unidades
          </p>
          {res.sobra != null && (
            <p className="text-[12.5px] font-bold" style={{ color: res.sobra > 0 ? "#3DD68C" : "#ff7a6b" }}>
              Vendendo a {formatCurrency(Number(produto?.sale_price))}, sobra {formatCurrency(res.sobra)} por unidade ({res.margem}% de margem).
            </p>
          )}
          {salvo ? (
            <div className="rounded-xl p-3 mt-1 flex gap-2 items-start" style={{ background: "rgba(61,214,140,.08)", border: "1px solid rgba(61,214,140,.35)" }}>
              <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#3DD68C" }} />
              <p className="text-[12.5px] leading-snug">
                Salvo: o custo foi pro produto, a mercadoria entrou no custo de hoje (sai do lucro)
                {salvo.conciliados > 0 ? ` e ${salvo.conciliados} ${salvo.conciliados === 1 ? "compra do banco virou" : "compras do banco viraram"} Mercadoria no extrato` : ""}.
              </p>
            </div>
          ) : (
            <button type="button" onClick={salvar} disabled={salvando || res.total <= 0}
              className="w-full h-12 mt-1 rounded-2xl text-[14px] font-black disabled:opacity-50"
              style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
              {salvando ? "Salvando…" : "SALVAR ESSE CUSTO"}
            </button>
          )}
          {salvo && (
            <button type="button" onClick={() => navigate("/products")} className="w-full h-10 rounded-xl text-[12.5px] font-extrabold" style={{ background: "#18181b", border: "1px solid #26262a" }}>
              Ver meus produtos
            </button>
          )}
        </section>
      )}
    </div>
  );
}
