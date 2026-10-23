/* "⋯" on someone else's post/comment: report (with a reason) or block the author. */
import { useState } from "react";
import { Flag, MoreHorizontal, UserX } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/shared/ui/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { useBloquearMutation, useDenunciarMutation, type MotivoDenuncia } from "../api/use-moderacao";

const MOTIVOS: [MotivoDenuncia, string][] = [
  ["ofensivo", "Ofensivo, ódio ou ameaça"],
  ["golpe", "Golpe ou fraude"],
  ["sexual", "Conteúdo sexual"],
  ["spam", "Spam ou propaganda"],
  ["outro", "Outro motivo"],
];

type Props = { autorId: string; autorNome: string | null; postId?: string; commentId?: string; onBloqueou?: () => void };

export function MenuDenuncia({ autorId, autorNome, postId, commentId, onBloqueou }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [denunciando, setDenunciando] = useState(false);
  const denunciar = useDenunciarMutation();
  const bloquear = useBloquearMutation(user?.id);
  const nome = autorNome ?? "esse vendedor";
  const fechar = () => { setAberto(false); setDenunciando(false); };

  const enviar = (motivo: MotivoDenuncia) => denunciar.mutate({ postId, commentId, motivo }, {
    onSuccess: () => { toast({ title: "Denúncia enviada", description: "A equipe da VANT vai analisar. Obrigado por avisar." }); fechar(); },
    onError: () => toast({ title: "Não consegui enviar a denúncia", description: "Tenta de novo em instantes.", variant: "destructive" }),
  });
  const bloquearAutor = () => bloquear.mutate(autorId, {
    onSuccess: () => { toast({ title: `Você bloqueou ${nome}`, description: "Os posts e comentários dele não aparecem mais pra você." }); fechar(); onBloqueou?.(); },
    onError: () => toast({ title: "Não consegui bloquear", description: "Tenta de novo em instantes.", variant: "destructive" }),
  });

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} aria-label="Mais opções"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <Sheet open={aberto} onOpenChange={(v) => (v ? setAberto(true) : fechar())}>
        <SheetContent side="bottom" className="p-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle className="text-base">{denunciando ? "Por que você está denunciando?" : commentId ? "Comentário" : "Post"}</SheetTitle>
          </SheetHeader>
          {denunciando ? (
            <div className="px-2">
              {MOTIVOS.map(([m, txt]) => (
                <button key={m} type="button" disabled={denunciar.isPending} onClick={() => enviar(m)}
                  className="w-full text-left px-3 py-3.5 rounded-xl text-[15px] hover:bg-muted/50 disabled:opacity-50">{txt}</button>
              ))}
            </div>
          ) : (
            <div className="px-2">
              <button type="button" onClick={() => setDenunciando(true)} className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-[15px] text-destructive hover:bg-muted/50">
                <Flag className="h-5 w-5" /> Denunciar {commentId ? "comentário" : "post"}
              </button>
              <button type="button" disabled={bloquear.isPending} onClick={bloquearAutor} className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-[15px] hover:bg-muted/50 disabled:opacity-50">
                <UserX className="h-5 w-5" /> Bloquear {nome}
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
