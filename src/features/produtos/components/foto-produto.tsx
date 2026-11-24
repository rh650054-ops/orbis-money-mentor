/* Product and flavour photos (24/11/2026). One picker for the registration, the product sheet and the
   flavours: take a photo (when the phone allows) or pick from the gallery, see it framed as it will
   appear (square, centred) before using it, change or remove it later. The photo is optional. */
import { useRef, useState, type ReactNode } from "react";
import { Camera, ImageIcon, Loader2, Trash2, X } from "lucide-react";

const FUNDOS = ["#3a2a0a,#161005", "#3a1420,#170a0e", "#2a0a3a,#100516", "#2a1a0e,#120b06", "#0a2a3a,#05101a"];
const MAX_ORIGINAL = 25 * 1024 * 1024;

/** The photo, or an elegant placeholder with the product's emoji. */
export function FotoOuMarca({ foto, emoji, i = 0, tamanho = 56 }: { foto: string | null | undefined; emoji: string | null | undefined; i?: number; tamanho?: number }) {
  const estilo = { width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.28) };
  return foto
    ? <img src={foto} alt="" loading="lazy" className="object-cover shrink-0" style={estilo} />
    : <span className="shrink-0 flex items-center justify-center" style={{ ...estilo, fontSize: Math.round(tamanho * 0.42), background: `linear-gradient(160deg,${FUNDOS[i % FUNDOS.length]})`, border: "1px solid #2a2722" }}>{emoji ?? "📦"}</span>;
}

/** What is wrong with a chosen file, in the seller's words (null = fine). */
export function problemaDoArquivo(f: File): string | null {
  if (!f.type.startsWith("image/")) return "Escolha uma imagem (JPG, PNG ou HEIC).";
  if (f.size > MAX_ORIGINAL) return "Essa foto é grande demais. Escolha outra.";
  return null;
}

export function FotoPicker({ foto, emoji, enviando, tamanho = 74, rotulo = "Adicionar foto", onEscolher, onRemover, gatilho }: {
  foto: string | null | undefined; emoji?: string | null; enviando?: boolean; tamanho?: number; rotulo?: string;
  onEscolher: (f: File) => void; onRemover?: () => void;
  /** a custom trigger (e.g. the photo column of a product card) instead of the square tile */
  gatilho?: (abrir: () => void) => ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [previa, setPrevia] = useState<{ arquivo: File; url: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const fechar = () => { if (previa) URL.revokeObjectURL(previa.url); setPrevia(null); setErro(null); setAberto(false); };
  const escolheu = (f: File | undefined) => {
    if (!f) return;
    const p = problemaDoArquivo(f);
    if (p) { setErro(p); return; }
    setErro(null); setPrevia({ arquivo: f, url: URL.createObjectURL(f) });
  };
  const entrada = (ref: React.RefObject<HTMLInputElement>, camOn: boolean) => (
    <input ref={ref} type="file" accept="image/*" {...(camOn ? { capture: "environment" as const } : {})} className="hidden"
      onChange={(e) => { escolheu(e.target.files?.[0]); e.target.value = ""; }} />
  );
  const opcao = "h-12 rounded-2xl px-4 flex items-center gap-3 text-[15px] font-extrabold text-left";
  return (
    <>
      {gatilho ? gatilho(() => setAberto(true)) : <button type="button" onClick={() => setAberto(true)} aria-label={foto ? "Trocar foto" : rotulo}
        className="shrink-0 flex flex-col items-center justify-center gap-0.5 overflow-hidden"
        style={{ width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.25), border: foto ? "1px solid #2a2722" : "1.5px dashed #3a3833", color: "#7b766e", background: "#0f0f10" }}>
        {enviando ? <Loader2 className="w-5 h-5 animate-spin" />
          : foto ? <img src={foto} alt="" className="w-full h-full object-cover" />
          : <><Camera className="w-5 h-5" /><span className="text-[9.5px] font-extrabold leading-tight text-center px-1">{emoji ? `${emoji} foto` : "foto"}</span></>}
      </button>}
      {entrada(camera, true)}{entrada(galeria, false)}
      {aberto && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70" onClick={fechar}>
          <div className="w-full max-w-md rounded-t-[24px] p-4 flex flex-col gap-2.5" onClick={(e) => e.stopPropagation()}
            style={{ background: "#121211", borderTop: "1px solid #2a2722", paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-black">{previa ? "Assim vai aparecer" : foto ? "Foto do produto" : rotulo}</span>
              <button type="button" onClick={fechar} aria-label="Fechar" className="p-1" style={{ color: "#7b766e" }}><X className="w-5 h-5" /></button>
            </div>
            {previa ? (
              <>
                <img src={previa.url} alt="Prévia" className="w-48 h-48 rounded-[24px] object-cover self-center" style={{ border: "1px solid #2a2722" }} />
                <p className="text-[11.5px] font-bold text-center" style={{ color: "#8a857b" }}>A foto é centralizada no quadrado. Se cortou o produto, escolha outra.</p>
                <button type="button" className="h-12 rounded-2xl text-[15px] font-black" style={{ background: "#F5B800", color: "#1A1200" }}
                  onClick={() => { onEscolher(previa.arquivo); fechar(); }}>USAR ESTA FOTO</button>
                <button type="button" className="h-11 rounded-2xl text-[14px] font-extrabold" style={{ color: "#d8d2c4" }}
                  onClick={() => { URL.revokeObjectURL(previa.url); setPrevia(null); }}>Escolher outra</button>
              </>
            ) : (
              <>
                <button type="button" className={opcao} style={{ background: "#1a1a19" }} onClick={() => camera.current?.click()}><Camera className="w-5 h-5" style={{ color: "#F5B800" }} /> Tirar foto</button>
                <button type="button" className={opcao} style={{ background: "#1a1a19" }} onClick={() => galeria.current?.click()}><ImageIcon className="w-5 h-5" style={{ color: "#F5B800" }} /> Escolher da galeria</button>
                {foto && onRemover && (
                  <button type="button" className={opcao} style={{ color: "#FF6B5E" }} onClick={() => { onRemover(); fechar(); }}><Trash2 className="w-5 h-5" /> Remover foto</button>
                )}
                {erro && <p className="text-[12px] font-bold" style={{ color: "#FF6B5E" }}>{erro}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
