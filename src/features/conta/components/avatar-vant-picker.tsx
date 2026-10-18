/* The VANT avatar family: same stroke, same geometry. Selected = gold outline,
   soft glow, scale 1.05; press = scale .96. */
import { AVATARES_VANT, caminhoAvatar } from "../lib/avatares";
import { COR, tique } from "./base";

export function AvatarVantPicker({ atual, onEscolher, disabled }: { atual: string | null; onEscolher: (caminho: string) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-5 gap-2.5" role="radiogroup" aria-label="Avatar VANT">
      {AVATARES_VANT.map((a) => {
        const caminho = caminhoAvatar(a.id);
        const sel = atual === caminho;
        return (
          <button key={a.id} type="button" role="radio" aria-checked={sel} aria-label={a.nome} disabled={disabled}
            onClick={() => { tique(); onEscolher(caminho); }}
            className="flex flex-col items-center gap-1 transition-transform duration-150 active:scale-[0.96] disabled:opacity-50"
            style={{ transform: sel ? "scale(1.05)" : undefined }}>
            <img src={caminho} alt="" width={52} height={52} className="rounded-full transition-shadow duration-200"
              style={{ boxShadow: sel ? `0 0 0 2px ${COR.ouro}, 0 0 16px -2px rgba(245,184,0,.6)` : `0 0 0 1px ${COR.borda}` }} />
            <span className="text-[10px] font-bold" style={{ color: sel ? COR.ouro : COR.apagado }}>{a.nome}</span>
          </button>
        );
      })}
    </div>
  );
}
