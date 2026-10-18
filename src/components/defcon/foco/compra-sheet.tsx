/* Compra de mercadoria em bottom sheet (NN/g: interação curta, contexto visível atrás,
   X sempre à vista). Abre do atalho, do card "Compra de mercadoria" e do "Repor X". */
import { X } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/shared/ui/drawer";
import { DefconCompraMercadoria } from "@/components/defcon/DefconCompraMercadoria";

interface Props {
  aberto: boolean;
  userId: string;
  produtoInicial: string | null;
  onFechar: () => void;
  onChanged: () => void;
}

export function CompraSheet({ aberto, userId, produtoInicial, onFechar, onChanged }: Props) {
  return (
    <Drawer open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DrawerContent className="rounded-t-[28px] border-0 px-[18px] pb-7 max-h-[92dvh] overflow-y-auto" style={{ background: "#121212" }}>
        <div className="flex items-start justify-between gap-3 mt-1">
          <div>
            <DrawerTitle className="text-[19px] font-extrabold tracking-[-.01em]">Compra de mercadoria</DrawerTitle>
            <p className="text-[12.5px] mt-1 leading-snug" style={{ color: "var(--orbis-fg-2)" }}>Registre uma compra pra atualizar estoque, custo por produto e o resumo do dia.</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,.08)", color: "var(--orbis-fg-2)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="mt-4">
          {aberto && <DefconCompraMercadoria userId={userId} produtoInicial={produtoInicial} onChanged={onChanged} onSalvo={onFechar} />}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
