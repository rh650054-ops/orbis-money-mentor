/* "Sua mercadoria de hoje" — bloco de ACOMPANHAMENTO, não de sugestão: produto
   principal com estoque, custo/un, preço e rendimento; os outros em linhas curtas
   com status (saudável / acabando / acabou). Vazio útil: explica e tem botão. */
import { ChevronRight, Package, Pencil, Plus } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { brl0, PRESS, type EstadoFoco, type ItemCarga } from "./foco-tipos";

type Status = "ok" | "acabando" | "acabou";
const PILL: Record<Status, { rotulo: string; cor: string }> = {
  ok: { rotulo: "saudável", cor: "#3dd68c" },
  acabando: { rotulo: "acabando", cor: "#f5b800" },
  acabou: { rotulo: "acabou", cor: "#e5737f" },
};
function statusDe(c: ItemCarga): Status {
  const resta = Math.max(0, c.levou - c.vendeu);
  if (c.levou > 0 && resta === 0) return "acabou";
  if (c.levou > 0 && resta / c.levou <= 0.25) return "acabando";
  return "ok";
}

interface Props {
  estado: EstadoFoco;
  carga: ItemCarga[];
  editando: boolean;
  onEditar: () => void;
  onVerEstoque: () => void;
  onRepor: (nome: string) => void;
  children?: React.ReactNode; // o gerenciador de carga, quando aberto
}

export function MercadoriaDoDia({ estado, carga, editando, onEditar, onVerEstoque, onRepor, children }: Props) {
  const tot = carga.reduce((t, c) => t + c.levou, 0);
  const vend = carga.reduce((t, c) => t + c.vendeu, 0);
  const entra = carga.reduce((t, c) => t + c.levou * c.preco, 0);
  const custo = carga.reduce((t, c) => t + c.levou * c.custo, 0);
  const ordenada = [...carga].sort((a, b) => b.levou * b.preco - a.levou * a.preco);
  const principal = ordenada[0];
  const outros = ordenada.slice(1);
  const faltando = carga.filter((c) => statusDe(c) !== "ok");
  const kpi = (k: string, v: string) => (
    <div className="rounded-[12px] px-2.5 py-2" style={{ background: "rgba(0,0,0,.35)", border: "1px solid var(--orbis-line)" }}>
      <p className="text-[10px] font-bold uppercase tracking-[.08em]" style={{ color: "var(--orbis-fg-3)" }}>{k}</p>
      <p className="orbis-num text-[14.5px] font-extrabold mt-0.5">{v}</p>
    </div>
  );

  return (
    <section className="mt-6 px-0.5" aria-label="Sua mercadoria de hoje">
      <div className="flex items-center justify-between">
        <p className="orbis-mini">{estado === "encerrado" ? "Sua mercadoria" : "Sua mercadoria de hoje"}</p>
        {carga.length > 0 && <button type="button" onClick={onVerEstoque} className="text-[11.5px] font-bold" style={{ color: "var(--orbis-gold)" }}>ver estoque ›</button>}
      </div>
      <div className="rounded-[20px] border mt-2.5 px-4 py-3.5" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
        {!principal ? (
          <button type="button" onClick={onVerEstoque} className={`w-full flex items-center gap-3 text-left ${PRESS}`}>
            <span className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.12)", color: "var(--orbis-gold)" }}><Package className="w-[18px] h-[18px]" strokeWidth={2} /></span>
            <span className="flex-1 min-w-0"><b className="block text-[14px] font-bold">Quer que a Vant controle seu estoque?</b><small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>Cadastra o que você vende — desconta sozinho a cada venda e avisa quando acabar.</small></span>
            <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "#5f5a50" }} />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "#1b1a17", color: "var(--orbis-fg-2)" }}><Package className="w-[18px] h-[18px]" strokeWidth={2} /></span>
              <span className="flex-1 min-w-0">
                <b className="block text-[14.5px] font-extrabold truncate">{estado === "rodando" ? `Saíram ${vend} de ${tot}` : principal.nome}</b>
                <small className="block text-[12px] mt-0.5 truncate" style={{ color: "var(--orbis-fg-3)" }}>
                  {estado === "rodando" ? carga.map((c) => `${c.nome} ${c.vendeu} de ${c.levou}`).join(" · ")
                    : estado === "encerrado" ? `${vend} unidades vendidas hoje${faltando.length ? ` · ${faltando.map((c) => c.nome.toLowerCase()).join(", ")} ${faltando.length === 1 ? "acabou" : "acabaram"}` : ""}`
                    : `produto principal · ${principal.levou} un na carga`}
                </small>
              </span>
              {estado === "rodando"
                ? <span className="text-right shrink-0"><b className="orbis-num block text-[15px] font-extrabold">{Math.max(0, tot - vend)}</b><small className="block text-[10.5px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>restam</small></span>
                : <Pill s={statusDe(principal)} />}
            </div>
            {estado === "antes" && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {kpi("Estoque", `${principal.levou} un`)}
                {kpi("Custo/un", principal.custo > 0 ? formatCurrency(principal.custo) : "—")}
                {kpi("Preço", principal.preco > 0 ? formatCurrency(principal.preco) : "—")}
              </div>
            )}
            {tot > 0 && (
              <div className="h-1.5 rounded-full mt-3 overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
                <div className="h-full rounded-full" style={{ width: `${estado === "antes" ? 100 : Math.min(100, (vend / tot) * 100)}%`, background: estado === "antes" ? "var(--orbis-ok)" : "linear-gradient(90deg,#F5B800,#FFC63A)" }} />
              </div>
            )}
            {estado === "antes" && entra > 0 && (
              <div className="flex justify-between text-[12px] mt-2" style={{ color: "var(--orbis-fg-2)" }}>
                <span>Se vender tudo entra <b style={{ color: "var(--orbis-ok)" }}>{brl0(entra)}</b></span>
                {entra - custo > 0 && <span>sobra <b style={{ color: "var(--orbis-ok)" }}>{brl0(entra - custo)}</b></span>}
              </div>
            )}
            {estado !== "rodando" && outros.length > 0 && (
              <div className="mt-3 pt-3 space-y-2.5" style={{ borderTop: "1px solid var(--orbis-line)" }}>
                {outros.map((c) => (
                  <div key={c.nome} className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "#1b1a17", color: "var(--orbis-fg-3)" }}><Package className="w-[15px] h-[15px]" strokeWidth={2} /></span>
                    <span className="flex-1 min-w-0"><b className="block text-[13.5px] font-bold truncate">{c.nome}</b><small className="block text-[11.5px]" style={{ color: "var(--orbis-fg-3)" }}>{Math.max(0, c.levou - c.vendeu)} un{c.custo > 0 ? ` · ${formatCurrency(c.custo)}/un` : ""}{c.preco > 0 ? ` · ${formatCurrency(c.preco)}` : ""}</small></span>
                    <Pill s={statusDe(c)} />
                  </div>
                ))}
              </div>
            )}
            {estado !== "rodando" && !editando && (
              <div className="flex gap-2 mt-3">
                {estado === "antes" && (
                  <button type="button" onClick={onEditar} className={`flex-1 h-[42px] rounded-[13px] inline-flex items-center justify-center gap-1.5 text-[13px] font-bold ${PRESS}`} style={{ border: "1px solid rgba(245,184,0,.4)", color: "var(--orbis-gold)" }}><Pencil className="w-3.5 h-3.5" /> Atualizar mercadoria</button>
                )}
                {faltando.length > 0 && (
                  <button type="button" onClick={() => onRepor(faltando[0]!.nome)} className={`flex-1 h-[42px] rounded-[13px] inline-flex items-center justify-center gap-1.5 text-[13px] font-extrabold ${PRESS}`} style={{ background: "linear-gradient(180deg,var(--orbis-gold-light),var(--orbis-gold))", color: "#1a1200" }}><Plus className="w-3.5 h-3.5" strokeWidth={3} /> Repor {faltando[0]!.nome.toLowerCase()}</button>
                )}
              </div>
            )}
            {editando && <div className="mt-3">{children}</div>}
          </>
        )}
      </div>
    </section>
  );
}

function Pill({ s }: { s: Status }) {
  const p = PILL[s];
  return <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[10.5px] font-extrabold tracking-[.06em] uppercase shrink-0" style={{ color: p.cor, background: `${p.cor}1f`, border: `1px solid ${p.cor}55` }}>{p.rotulo}</span>;
}
