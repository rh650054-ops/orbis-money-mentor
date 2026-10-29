/* SOBROU HOJE (Rick, 29/10/2026): at the end of the DEFCON, next to "vendeu", the number he
   really wants — what is his. Known cost → "≈ R$ X limpos". Unknown → "R$ ?" and the
   1-minute capture right there; saving shows the number on the spot. */
import { useState } from "react";
import { HelpCircle, Sparkles, Wallet } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { CadastroRapido, useProdutosQuery } from "@/features/produtos";
import { useSobrarMesQuery } from "../api/use-sobrar-mes";
import { nomeUnidade } from "../lib/plano";
import { brl0 } from "../lib/formato";
import { COR } from "./ui";

const brl2 = (n: number) => "R$ " + n.toFixed(2).replace(".", ",");
const chaveDepois = (dia: string) => `vant_sobrou_depois_${dia}`;
const pulouHoje = (dia: string) => { try { return localStorage.getItem(chaveDepois(dia)) === "1"; } catch { return false; } };

export function SobrouHoje({ userId, vendido, precoSugerido, dia }: { userId: string | undefined; vendido: number; precoSugerido: number; dia: string }) {
  const { toast } = useToast();
  const sobrar = useSobrarMesQuery(userId);
  const produtos = useProdutosQuery(userId);
  const [depois, setDepois] = useState(() => pulouHoje(dia));
  const [revelado, setRevelado] = useState<number | null>(null);
  const s = sobrar.data;
  if (!s || vendido <= 0) return null;

  const semCusto = s.fonte_custo === "sem_custo";
  const margem = s.ticket > 0 ? s.lucro_unid / s.ticket : 0;
  const un = nomeUnidade(s.produto_nome, 1);
  const semCustoProd = (produtos.data ?? []).find((p) => !(p.cost > 0));
  const existente = semCustoProd ? { id: semCustoProd.id, nome: semCustoProd.name, preco: semCustoProd.sale_price } : null;

  if (!semCusto || revelado !== null) {
    const sobrou = revelado !== null ? revelado : vendido * margem;
    return (
      <section className="rounded-[16px] px-3.5 py-3" style={{ background: "rgba(245,184,0,.07)", border: "1px solid rgba(245,184,0,.3)" }} aria-label="Sobrou hoje">
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[.14em]" style={{ color: COR.ouro }}><Wallet className="w-3.5 h-3.5" /> Sobrou pra você</p>
          <span className="orbis-num text-[20px] font-black" style={{ color: COR.ouro }}>≈ {brl0(sobrou)}</span>
        </div>
        <p className="text-[11.5px] mt-1 leading-snug" style={{ color: COR.sub }}>
          {revelado !== null
            ? <>Agora a VANT sabe quanto cada {un} deixa. Amanhã o Foco já mostra o seu lucro do mês.</>
            : <>{brl2(s.lucro_unid)} por {un}, depois do custo e do calote · sem contar o corre de hoje</>}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2.5" aria-label="Sobrou hoje">
      <div className="rounded-[16px] px-3.5 py-3" style={{ background: "rgba(245,184,0,.07)", border: "1px solid rgba(245,184,0,.3)" }}>
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[.14em]" style={{ color: COR.ouro }}><Wallet className="w-3.5 h-3.5" /> Sobrou pra você</p>
          <span className="orbis-num text-[20px] font-black inline-flex items-center gap-1" style={{ color: COR.ouro }}>R$ <HelpCircle className="w-5 h-5" /></span>
        </div>
        <p className="text-[12px] mt-1.5 leading-snug" style={{ color: COR.texto }}>
          <Sparkles className="inline w-3.5 h-3.5 -mt-0.5 mr-1" style={{ color: COR.ouro }} />
          Você vendeu <b>{brl0(vendido)}</b> hoje. <b>Quanto disso é seu?</b> Me diz o que custa a {un} e eu te mostro agora.
        </p>
        {depois && (
          <button type="button" onClick={() => setDepois(false)} className="mt-2 text-[12px] font-black" style={{ color: COR.ouro }}>Descobrir em 1 minuto →</button>
        )}
      </div>
      {!depois && (
        <CadastroRapido userId={userId} precoSugerido={precoSugerido} existente={existente}
          onSalvo={(lucroUnid, preco) => {
            const valor = vendido * (Math.max(0, lucroUnid - s.calote_unid) / Math.max(1, preco));
            setRevelado(valor);
            toast({ title: `Hoje sobrou ≈ ${brl0(valor)}`, description: "Agora o lucro aparece no Foco e no relatório." });
          }}
          onDepois={() => { try { localStorage.setItem(chaveDepois(dia), "1"); } catch { /* sem storage */ } setDepois(true); }} />
      )}
    </section>
  );
}
