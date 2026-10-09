/* Carga do dia passou do estoque (Rick, 07/10): em vez de deixar levar 20 de um
   produto que tem 12, pergunta. "Chegou mais" acerta o estoque e leva; senão leva
   só o que tem. Usado na Carga do Dia e na Mercadoria de hoje. */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import type { AvisoEstoque } from "@/hooks/useDefconLoadout";

export function AvisoEstoqueCarga({ aviso, onTenhoMais, onSoOQueTem, onFechar }: {
  aviso: AvisoEstoque | null;
  onTenhoMais: () => void;
  onSoOQueTem: () => void;
  onFechar: () => void;
}) {
  return (
    <Dialog open={!!aviso} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-w-sm">
        {aviso && (
          <>
            <DialogHeader>
              <DialogTitle>Você tem só {aviso.podeLevar} de {aviso.nome}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              O estoque diz {aviso.podeLevar}, e você quer levar {aviso.quer}. Chegou mercadoria e o estoque ficou desatualizado?
            </p>
            <button type="button" onClick={onTenhoMais}
              className="w-full rounded-xl py-3 font-extrabold" style={{ background: "var(--orbis-gold)", color: "#1A1200" }}>
              Tenho {aviso.quer}: atualizar o estoque e levar
            </button>
            {aviso.podeLevar > 0 ? (
              <button type="button" onClick={onSoOQueTem} className="w-full rounded-xl py-3 font-bold border border-border">
                Levar só {aviso.podeLevar}
              </button>
            ) : (
              <button type="button" onClick={onFechar} className="w-full rounded-xl py-3 font-bold border border-border">
                Cancelar
              </button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
