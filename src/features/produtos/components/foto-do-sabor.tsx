/* A flavour's own photo (24/11/2026): saved right away on the flavour, apart from the sheet's SALVAR.
   Only a flavour that already exists can have one (a new flavour gets its id when the product is saved). */
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { apagarFotosOrfas, useFotoSaborDisponivel, useFotoSaborMutation } from "../api/fotos";
import { useSubirFotoMutation } from "../api/use-subir-foto-mutation";
import type { SaborRascunho } from "../lib/sabores";
import { FotoPicker } from "./foto-produto";

export function FotoDoSabor({ s, onFoto }: { s: SaborRascunho; onFoto: (url: string | null) => void }) {
  return s.id ? <FotoDoSaborSalvo s={s} id={s.id} onFoto={onFoto} /> : null;
}

function FotoDoSaborSalvo({ s, id, onFoto }: { s: SaborRascunho; id: string; onFoto: (url: string | null) => void }) {
  const { user } = useAuth();
  const subir = useSubirFotoMutation(user?.id);
  const gravar = useFotoSaborMutation(user?.id);
  const disponivel = useFotoSaborDisponivel().data === true;
  if (!disponivel) return null;
  const falhou = () => toast({ title: "Não consegui salvar a foto do sabor", description: "Tente de novo (até 5 MB).", variant: "destructive" });
  return (
    <FotoPicker foto={s.foto ?? null} emoji={s.emoji} tamanho={44} rotulo={`Foto de ${s.nome.trim() || "sabor"}`} enviando={subir.isPending || gravar.isPending}
      onEscolher={(f) => subir.mutate(f, {
        onSuccess: (url) => gravar.mutate({ saborId: id, foto: url, anterior: s.foto ?? null }, {
          onSuccess: () => onFoto(url),
          onError: () => { void apagarFotosOrfas([url], user?.id); falhou(); },
        }),
        onError: falhou,
      })}
      onRemover={() => gravar.mutate({ saborId: id, foto: null, anterior: s.foto ?? null }, { onSuccess: () => onFoto(null), onError: falhou })} />
  );
}
