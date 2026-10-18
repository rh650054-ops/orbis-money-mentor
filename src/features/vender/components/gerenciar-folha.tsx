/* "Gerenciar conexões": classify, refresh, disconnect — all in one sheet. */
import { RefreshCw } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { avisoPapel } from "@/components/conectar/PapelContas";
import type { BancoLigado, ContaVenda } from "@/components/conectar/pluggy";
import { Botao, COR, Folha } from "@/shared/components/vant-ui";
import { useDesligarMutation, usePapelMutation } from "../api/use-vender-mutations";
import { ContaGestaoLinha } from "./conta-gestao-linha";

interface Props {
  aberta: boolean; onFechar: () => void; bancos: BancoLigado[]; contas: ContaVenda[];
  atualizando: boolean; onAtualizar: () => void;
}

export function GerenciarFolha({ aberta, onFechar, bancos, contas, atualizando, onAtualizar }: Props) {
  const papel = usePapelMutation();
  const desligar = useDesligarMutation();

  const mudarPapel = async (b: BancoLigado, p: "trabalho" | "pessoal") => {
    const r = await papel.mutateAsync({ id: b.id, papel: p });
    return avisoPapel(r, b.institution_name ?? "Banco", p);
  };
  const sair = (b: BancoLigado) => desligar.mutate(b.id, {
    onSuccess: (r) => {
      if (!r.ok) { toast({ title: "Não deu pra desconectar", description: "Tenta de novo em instantes.", variant: "destructive" }); return; }
      toast({ title: `${r.banco} desconectado`, description: "A Vant parou de ler esse banco. O que já entrou fica no histórico." });
      if (bancos.length <= 1) onFechar();
    },
  });

  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Gerenciar conexões" sub="Defina o que é trabalho e o que é pessoal. A Vant só lê o que entrou: não move dinheiro e não vê senha.">
      <Botao onClick={onAtualizar} disabled={atualizando} className="w-full inline-flex items-center justify-center gap-2">
        <RefreshCw className={`w-4 h-4 ${atualizando ? "animate-spin" : ""}`} /> {atualizando ? "Lendo os bancos…" : "Conferir de novo agora"}
      </Botao>
      <div className="rounded-[16px] px-3.5 divide-y divide-[#1b1a17]" style={{ background: COR.card, border: `1px solid ${COR.borda}` }}>
        {bancos.map((b) => (
          <ContaGestaoLinha key={b.id} banco={b} conta={contas.find((c) => c.id === b.id)}
            salvando={papel.isPending && papel.variables?.id === b.id}
            saindo={desligar.isPending && desligar.variables === b.id}
            onPapel={(p) => mudarPapel(b, p)} onDesligar={() => sair(b)} />
        ))}
      </div>
      <p className="text-[11px] leading-relaxed" style={{ color: COR.apagado }}>
        Virou trabalho agora? Vale daqui pra frente: Pix antigo não entra no ranking. Desconectando, a Vant para de ler o banco na hora{bancos.length <= 1 ? " e o selo de verificado sai" : ""}.
      </p>
    </Folha>
  );
}
