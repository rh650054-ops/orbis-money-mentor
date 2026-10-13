/* Ficha: estoque do produto pronto e o aviso de "acabando". */
import type { Ficha } from "../lib/ficha";
import { Contador } from "./campos";
import { Interruptor, Secao } from "./ficha-secao";

export function FichaEstoque({ f, levas, onMudar }: {
  f: Ficha; levas: number | null; onMudar: (m: Partial<Ficha>) => void;
}) {
  return (
    <Secao titulo="ESTOQUE" sub="Cada venda no Foco baixa daqui sozinha.">
      <Interruptor ligado={f.controlaEstoque} onMudar={(controlaEstoque) => onMudar({ controlaEstoque })}
        titulo="Controlar estoque" sub={f.controlaEstoque ? "Te aviso quando estiver acabando." : "Faço na hora / não quero contar."} />
      {f.controlaEstoque && (
        <>
          <Contador rotulo="Tem agora (prontas pra vender)" valor={f.estoque} onChange={(estoque) => onMudar({ estoque })} unidade="un" />
          <Contador rotulo="Me avisa quando ficar com menos de" valor={f.estoqueMin} onChange={(estoqueMin) => onMudar({ estoqueMin })} unidade="un" />
          {levas !== null && levas > 0 && (
            <p className="text-[12px] font-bold px-1" style={{ color: "#3DD68C" }}>
              Com os ingredientes guardados ainda dá pra mais {levas} leva{levas > 1 ? "s" : ""} ({levas * f.rende} un).
            </p>
          )}
        </>
      )}
    </Secao>
  );
}
