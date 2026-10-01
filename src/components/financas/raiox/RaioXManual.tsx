/* Raio-X do extrato — lançar na mão um gasto (ou entrada) que não está em nenhum
   extrato: dinheiro vivo, conta de outra pessoa, compra que o banco não mostrou.
   Entra nos totais e nas categorias igual aos lidos do extrato. */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { RaioXCategoriaDef } from "@/hooks/useRaioXExtrato";
import { lancarManual } from "@/hooks/useRaioXInteligencia";
import { toast } from "@/shared/hooks/use-toast";
import { lerValor } from "./raiox-utils";

interface Props {
  categorias: RaioXCategoriaDef[];
  bancos: string[];
  onSalvo: (mes: string) => void | Promise<void>;
}

const FORA = new Set(["nao_identificado", "transferencia_propria"]);
const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const campo = { background: "#171716", borderColor: "rgba(255,255,255,.1)", color: "#F4F1EA" };

export default function RaioXManual({ categorias, bancos, onSalvo }: Props) {
  const [tipo, setTipo] = useState<"saida" | "entrada">("saida");
  const [valorTxt, setValorTxt] = useState("");
  const [data, setData] = useState(hoje());
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("mercado");
  const [banco, setBanco] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const opcoes = categorias.filter((c) => c.tipo === tipo && !FORA.has(c.slug));

  const trocarTipo = (t: "saida" | "entrada") => {
    setTipo(t);
    setCategoria(t === "saida" ? "mercado" : "pix_recebido");
  };

  const salvar = async () => {
    setErro("");
    const valor = lerValor(valorTxt);
    if (valor <= 0) { setErro("Coloca o valor."); return; }
    if (!descricao.trim()) { setErro("Diz o que foi (ex: rancho do mês, gelo, aluguel)."); return; }
    setSalvando(true);
    const r = await lancarManual({ data, valor, tipo, descricao: descricao.trim(), categoria, banco: banco || null });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro ?? "Não consegui salvar."); return; }
    toast({ title: tipo === "saida" ? "Gasto lançado" : "Entrada lançada", description: "Já entrou no Raio-X do mês." });
    await onSalvo(`${data.slice(0, 7)}-01`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-[22px] font-black tracking-tight text-foreground">Lançar na mão</h1>
        <p className="text-[12.5px] mt-1.5 leading-snug" style={{ color: "#a9a49c" }}>
          Pra o que não aparece em extrato nenhum: dinheiro vivo, rancho que outra pessoa pagou, compra no fiado.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 rounded-xl p-1" style={{ background: "#131211" }}>
        {(["saida", "entrada"] as const).map((t) => (
          <button key={t} type="button" onClick={() => trocarTipo(t)} className="h-9 rounded-lg text-[13px] font-extrabold"
            style={tipo === t ? { background: "#FFC800", color: "#1A1200" } : { color: "#7e7869" }}>
            {t === "saida" ? "Gasto" : "Entrada"}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: ".1em", color: "#7e7869" }}>Valor</span>
        <input inputMode="decimal" placeholder="0,00" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)}
          className="h-12 rounded-xl border px-3 text-[20px] font-black tabular-nums" style={campo} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: ".1em", color: "#7e7869" }}>O que foi</span>
        <input maxLength={60} placeholder="Ex: rancho do mês (Isis pagou)" value={descricao} onChange={(e) => setDescricao(e.target.value)}
          className="h-11 rounded-xl border px-3 text-[14px]" style={campo} />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: ".1em", color: "#7e7869" }}>Dia</span>
          <input type="date" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} className="h-11 rounded-xl border px-3 text-[14px]" style={campo} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: ".1em", color: "#7e7869" }}>Conta</span>
          <select value={banco} onChange={(e) => setBanco(e.target.value)} className="h-11 rounded-xl border px-2 text-[14px]" style={campo}>
            <option value="">Dinheiro</option>
            {bancos.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: ".1em", color: "#7e7869" }}>Categoria</span>
        <div className="flex gap-1.5 flex-wrap">
          {opcoes.map((c) => (
            <button key={c.slug} type="button" onClick={() => setCategoria(c.slug)} className="rounded-full px-2.5 py-1.5 text-[12px] font-bold border"
              style={categoria === c.slug ? { background: "#FFC800", color: "#1A1200", borderColor: "transparent" } : { background: "#171716", color: "#e8e3d8", borderColor: "rgba(255,255,255,.1)" }}>
              {c.icone} {c.rotulo}
            </button>
          ))}
        </div>
      </div>

      {erro && <p className="text-[12.5px] font-bold" style={{ color: "#FF8A7A" }}>{erro}</p>}

      <button type="button" onClick={salvar} disabled={salvando} className="w-full h-12 rounded-xl text-[15px] font-extrabold disabled:opacity-60"
        style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
        {salvando ? <Loader2 className="w-5 h-5 animate-spin inline" /> : tipo === "saida" ? "Lançar gasto" : "Lançar entrada"}
      </button>
    </div>
  );
}
