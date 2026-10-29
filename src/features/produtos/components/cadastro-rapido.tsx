/* CADASTRO DE 1 MINUTO (Rick, 29/10/2026): the VANT never asks for data, it shows what it
   can't tell without it. "Sobrou R$ ?" → what do you sell, for how much (already known from
   the DEFCON), what does it cost to make (a guess is fine). Saves and the pocket number shows. */
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { MoneyInput } from "@/shared/ui/money-input";
import { useToast } from "@/shared/hooks/use-toast";
import { useCustoRapidoMutation } from "../api/use-custo-rapido-mutation";

const OURO = "#F5B800";
const NOMES = ["Batida", "Trufa", "Bala", "Brigadeiro", "Outro"];
const CUSTOS = [2, 3, 4, 5];

export function CadastroRapido({ userId, precoSugerido, existente, onSalvo, onDepois }: {
  userId: string | undefined;
  /** the most common sale of the day: the price is already known */
  precoSugerido: number;
  /** he already has a product, only the cost is missing */
  existente?: { id: string; nome: string; preco: number } | null;
  /** profit per unit before calote, and the price it was computed from */
  onSalvo: (lucroUnid: number, preco: number) => void;
  onDepois?: () => void;
}) {
  const { toast } = useToast();
  const salvar = useCustoRapidoMutation(userId);
  const [nome, setNome] = useState(existente?.nome ?? "Batida");
  const [outro, setOutro] = useState("");
  const [preco, setPreco] = useState(existente?.preco || precoSugerido);
  const [custo, setCusto] = useState(0);
  const nomeFinal = nome === "Outro" ? outro.trim() : nome;
  const ok = nomeFinal.length > 0 && preco > 0 && custo > 0 && custo < preco;
  const chip = (on: boolean) => ({
    className: "h-9 px-3 rounded-full text-[12.5px] font-black active:scale-[0.97] transition-transform",
    style: on ? { background: "rgba(245,184,0,.16)", border: `1px solid ${OURO}`, color: OURO } : { background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#b9b3a6" },
  });
  const caixa = (ouro = false) => ({ background: ouro ? "rgba(245,184,0,.08)" : "rgba(0,0,0,.4)", border: `1px solid ${ouro ? OURO : "rgba(255,255,255,.1)"}` });

  const confirmar = () => {
    salvar.mutate({ produtoId: existente?.id, nome: nomeFinal, preco, custo }, {
      onSuccess: () => onSalvo(preco - custo, preco),
      onError: () => toast({ title: "Não consegui salvar", description: "Tenta de novo em instantes.", variant: "destructive" }),
    });
  };

  return (
    <div className="rounded-[18px] p-4" style={{ background: "#131211", border: "1px solid rgba(255,255,255,.1)" }} aria-label="Cadastro de 1 minuto">
      <p className="text-[10.5px] font-extrabold uppercase tracking-[.14em]" style={{ color: OURO }}>Cadastro de 1 minuto</p>
      {!existente && (<>
        <p className="text-[13.5px] font-extrabold mt-2">O que você vendeu hoje?</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {NOMES.map((n) => <button key={n} type="button" onClick={() => setNome(n)} aria-pressed={nome === n} {...chip(nome === n)}>{n}</button>)}
        </div>
        {nome === "Outro" && <input value={outro} onChange={(e) => setOutro(e.target.value)} placeholder="Nome do produto" aria-label="Nome do produto"
          className="mt-2 w-full h-11 rounded-[12px] px-3 text-[14px] bg-transparent" style={caixa()} />}
      </>)}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <label className="rounded-[12px] px-3 py-2.5" style={caixa()}>
          <span className="block text-[10.5px] font-bold" style={{ color: "#7e7869" }}>Vende por</span>
          <MoneyInput value={preco} onChange={setPreco} decimals={2} className="border-0 bg-transparent px-0 h-8 text-[20px] font-black focus-visible:ring-0" id="cr-preco" />
          <span className="block text-[10px]" style={{ color: "#3DD68C" }}>{existente ? "do seu cadastro" : "já sei, pelo DEFCON"}</span>
        </label>
        <label className="rounded-[12px] px-3 py-2.5" style={caixa(true)}>
          <span className="block text-[10.5px] font-bold" style={{ color: OURO }}>Custa pra fazer</span>
          <MoneyInput value={custo} onChange={setCusto} decimals={2} placeholder="?" className="border-0 bg-transparent px-0 h-8 text-[20px] font-black focus-visible:ring-0" id="cr-custo" />
          <span className="block text-[10px]" style={{ color: "#b9b3a6" }}>chuta, ajusta depois</span>
        </label>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {CUSTOS.map((c) => <button key={c} type="button" onClick={() => setCusto(c)} aria-pressed={custo === c} {...chip(custo === c)}>R$ {c}</button>)}
      </div>
      {ok && (
        <p className="text-[12px] mt-3 leading-snug" style={{ color: "#b9b3a6" }}>
          Cada {nomeFinal.toLowerCase()} põe <b style={{ color: OURO }}>R$ {(preco - custo).toFixed(2).replace(".", ",")}</b> no seu bolso, antes do calote.
        </p>
      )}
      <button type="button" onClick={confirmar} disabled={!ok || salvar.isPending}
        className="mt-3 w-full h-[50px] rounded-[14px] inline-flex items-center justify-center gap-2 text-[14.5px] font-black disabled:opacity-50 active:translate-y-[1px]"
        style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
        {salvar.isPending ? "Salvando…" : <>Salvar e ver quanto sobrou <ArrowRight className="w-4 h-4" /></>}
      </button>
      {onDepois && <button type="button" onClick={onDepois} className="mt-2 w-full h-10 text-[12.5px] font-bold" style={{ color: "#7e7869" }}>Amanhã</button>}
    </div>
  );
}
