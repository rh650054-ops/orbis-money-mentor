/* The photo column of a product card (24/11/2026, Rick's mockup): the seller's OWN photo fills the left
   side of the card. Without one, the column invites him to add it, right there; with one, a small camera
   button changes it. Saved straight on the product (nothing else on the card changes). */
import { Camera, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { apagarFotosOrfas, useFotoProdutoMutation } from "../api/fotos";
import { useSubirFotoMutation } from "../api/use-subir-foto-mutation";
import { FotoPicker } from "./foto-produto";

const FUNDOS = ["#3a2a0a,#120d05", "#3a1420,#12080b", "#2a0a3a,#0d0512", "#2a1a0e,#100a06", "#0a2a3a,#05101a"];

export function FotoDoCard({ produtoId, foto, emoji, nome, i, onAbrir }: {
  produtoId: string; foto: string | null; emoji: string | null; nome: string; i: number; onAbrir: () => void;
}) {
  const { user } = useAuth();
  const subir = useSubirFotoMutation(user?.id);
  const gravar = useFotoProdutoMutation(user?.id);
  const enviando = subir.isPending || gravar.isPending;
  const falhou = () => toast({ title: "Não consegui salvar a foto", description: "Tente outra foto (até 5 MB).", variant: "destructive" });
  const escolher = (f: File) => subir.mutate(f, {
    onSuccess: (url) => gravar.mutate({ produtoId, foto: url, anterior: foto }, { onError: () => { void apagarFotosOrfas([url], user?.id); falhou(); } }),
    onError: falhou,
  });
  return (
    <FotoPicker foto={foto} rotulo={`Foto de ${nome}`} onEscolher={escolher}
      onRemover={() => gravar.mutate({ produtoId, foto: null, anterior: foto }, { onError: falhou })}
      gatilho={(abrir) => (
        <div className="relative w-[84px] min-h-[104px] shrink-0 overflow-hidden" style={{ background: `linear-gradient(160deg,${FUNDOS[i % FUNDOS.length]})` }}>
          {foto ? (
            <>
              <button type="button" onClick={onAbrir} aria-label={`Abrir ${nome}`} className="absolute inset-0">
                <img src={foto} alt="" loading="lazy" className="w-full h-full object-cover" />
              </button>
              <button type="button" onClick={abrir} aria-label="Trocar foto" className="absolute left-1.5 bottom-1.5 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,0,0,.6)", border: "1px solid rgba(255,255,255,.18)" }}>
                {enviando ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Camera className="w-3.5 h-3.5 text-white" />}
              </button>
            </>
          ) : (
            <button type="button" onClick={abrir} className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1.5 text-center">
              {enviando ? <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#F5B800" }} /> : <span className="text-[24px] leading-none">{emoji ?? "📦"}</span>}
              <span className="flex flex-col items-center gap-0.5 rounded-[8px] px-1.5 py-1 text-[10px] font-extrabold leading-tight" style={{ background: "rgba(0,0,0,.55)", color: "#F5B800" }}>
                <Camera className="w-3.5 h-3.5" /> Adicionar foto
              </span>
            </button>
          )}
        </div>
      )} />
  );
}
