/* Raio-X do extrato — tela de envio. O vendedor escolhe um ou vários arquivos
   (de bancos diferentes, se quiser); a gente manda um por vez pra IA e mostra o
   andamento de cada um. O mês é identificado no próprio arquivo. */
import { useRef, useState } from "react";
import { Loader2, Trash2, FileText, Check, AlertTriangle } from "lucide-react";
import { enviarExtrato, type RaioXArquivo, type EnvioProgresso } from "@/hooks/useRaioXExtrato";
import { mesNome } from "./raiox-utils";

interface Item { nome: string; estado: "fila" | "lendo" | "ok" | "erro"; msg?: string; banco?: string | null; progresso?: EnvioProgresso }

interface Props {
  mes: string | null;
  arquivos: RaioXArquivo[];
  onTerminou: (mesesTocados: string[]) => void | Promise<void>;
  onApagar: (id: string) => Promise<boolean>;
}

export default function RaioXEnviar({ mes, arquivos, onTerminou, onApagar }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [rodando, setRodando] = useState(false);
  const [apagando, setApagando] = useState<string | null>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 6);
    if (e.target) e.target.value = "";
    if (files.length === 0) return;
    setRodando(true);
    setItens(files.map((f) => ({ nome: f.name, estado: "fila" })));
    const meses: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i]!;
      setItens((prev) => prev.map((it, j) => (j === i ? { ...it, estado: "lendo" } : it)));
      const r = await enviarExtrato(f, (progresso) =>
        setItens((prev) => prev.map((it, j) => (j === i ? { ...it, progresso } : it))));
      if (r.ok) for (const m of r.meses ?? (r.mes ? [r.mes] : [])) meses.push(m);
      const resumoMeses = (ms: string[]) => ms.length > 1 ? ` · ${mesNome(ms[0]!)} a ${mesNome(ms[ms.length - 1]!)}` : ms[0] ? ` · ${mesNome(ms[0])}` : "";
      setItens((prev) => prev.map((it, j) => j !== i ? it : r.ok
        ? { ...it, estado: "ok", banco: r.banco, progresso: undefined, msg: r.jaLido ? "já tinha sido lido" : `${r.novos} lançamento${r.novos === 1 ? "" : "s"}${r.repetidos ? ` · ${r.repetidos} já tinha` : ""}${resumoMeses(r.meses ?? (r.mes ? [r.mes] : []))}${r.erro ? ` · ${r.erro}` : ""}` }
        : { ...it, estado: "erro", progresso: undefined, msg: r.erro }));
    }
    setRodando(false);
    await onTerminou(meses);
  };

  const handleApagar = async (a: RaioXArquivo) => {
    if (!window.confirm(`Apagar o extrato${a.banco ? ` do ${a.banco}` : ""} e os ${a.lancamentos} lançamentos dele?`)) return;
    setApagando(a.id);
    await onApagar(a.id);
    setApagando(null);
  };

  const fmtD = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-[22px] font-black tracking-tight text-foreground">Manda o extrato</h1>
        <p className="text-[12.5px] mt-1.5 leading-snug" style={{ color: "#a9a49c" }}>
          PDF ou print da lista de movimentações. Pode mandar de vários bancos e de vários meses de uma vez — a Vant separa tudo por mês sozinha.
        </p>
      </div>

      <input ref={inputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFiles} disabled={rodando} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={rodando}
        className="w-full rounded-2xl text-center px-4 py-6 disabled:opacity-60"
        style={{ border: "1.5px dashed rgba(255,200,0,.5)", background: "rgba(255,200,0,.04)" }}
      >
        <div className="text-[34px] leading-none">📄</div>
        <b className="block text-[15px] mt-2 text-foreground">Toque pra escolher os arquivos</b>
        <span className="block text-[12px] mt-1 leading-snug" style={{ color: "#7e7869" }}>
          Nubank, Mercado Pago, PicPay, Inter, Caixa, Itaú, Bradesco, C6, PagBank…<br />o mês é identificado sozinho
        </span>
      </button>

      {itens.length > 0 && (
        <section className="rounded-2xl border px-4" style={{ background: "#131211", borderColor: "rgba(255,255,255,.07)" }}>
          {itens.map((it, i) => (
            <div key={i} className="flex items-center gap-2.5 py-3" style={{ borderTop: i ? "1px solid rgba(255,255,255,.07)" : undefined }}>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#1c1c1b" }}>
                {it.estado === "lendo" ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#FFC800" }} />
                  : it.estado === "ok" ? <Check className="w-4 h-4" style={{ color: "#3DD68C" }} />
                  : it.estado === "erro" ? <AlertTriangle className="w-4 h-4" style={{ color: "#FF5A45" }} />
                  : <FileText className="w-4 h-4" style={{ color: "#7e7869" }} />}
              </span>
              <div className="min-w-0 flex-1">
                <b className="block text-[13px] truncate text-foreground">{it.banco ? `${it.banco} · ` : ""}{it.nome}</b>
                <span className="block text-[11px] font-semibold leading-snug" style={{ color: it.estado === "erro" ? "#FF8A7A" : "#7e7869" }}>
                  {it.estado === "fila" ? "na fila"
                    : it.estado === "lendo" ? (it.progresso ? `lendo parte ${it.progresso.parte} de ${it.progresso.total}… uns 20 segundos cada` : "lendo… leva uns 20 segundos")
                    : it.msg}
                </span>
              </div>
            </div>
          ))}
        </section>
      )}

      {mes && arquivos.length > 0 && (
        <section className="rounded-2xl border px-4 pt-3 pb-1" style={{ background: "#131211", borderColor: "rgba(255,255,255,.07)" }}>
          <p className="orbis-section">Já enviados em {mesNome(mes)}</p>
          {arquivos.map((a, i) => (
            <div key={a.id} className="flex items-center gap-2.5 py-3" style={{ borderTop: i ? "1px solid rgba(255,255,255,.07)" : undefined }}>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[16px]" style={{ background: "#1c1c1b" }}>🏦</span>
              <div className="min-w-0 flex-1">
                <b className="block text-[13px] truncate text-foreground">{a.banco ?? "Banco"}{a.origem === "pluggy" ? " · automático" : ""}</b>
                <span className="block text-[11px] font-semibold" style={{ color: "#7e7869" }}>
                  {a.inicio && a.fim ? `${fmtD(a.inicio)} a ${fmtD(a.fim)} · ` : ""}{a.lancamentos} lançamento{a.lancamentos === 1 ? "" : "s"}
                </span>
              </div>
              <button type="button" onClick={() => handleApagar(a)} disabled={apagando !== null} className="p-2 rounded-lg" style={{ color: "#7e7869" }} aria-label="Apagar extrato">
                {apagando === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </section>
      )}

      <div className="rounded-2xl p-3 text-[12.5px] leading-snug" style={{ background: "rgba(255,200,0,.06)", border: "1px solid rgba(255,200,0,.3)", color: "#a9a49c" }}>
        <b style={{ color: "#FFC800" }}>Fica tranquilo:</b> o arquivo é lido e descartado. A Vant guarda só o nome do lançamento, o valor e a data — nunca número de conta, agência ou saldo.
      </div>
    </div>
  );
}
