/* Tap on the picture: take a photo, pick one, use a VANT avatar or remove it. */
import { useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { avisar } from "@/shared/lib/avisar";
import { AvatarCropper } from "@/components/AvatarCropper";
import { useFotoMutation, type MudancaFoto } from "../api/use-foto-mutation";
import { AvatarVantPicker } from "./avatar-vant-picker";
import { COR, Folha } from "@/shared/components/vant-ui";

type Props = { aberta: boolean; onFechar: () => void; userId: string; atual: string | null; temFoto: boolean };

export function FotoMenu({ aberta, onFechar, userId, atual, temFoto }: Props) {
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [recorte, setRecorte] = useState<string | null>(null);
  const foto = useFotoMutation(userId);

  const aplicar = (m: MudancaFoto, ok: string) =>
    foto.mutate(m, {
      onSuccess: () => { toast({ title: ok }); onFechar(); },
      onError: (e) => { avisar.erro("conta: foto", e); toast({ title: "Não deu pra salvar a foto", description: "Tenta de novo.", variant: "destructive" }); },
    });

  const lerArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 12 * 1024 * 1024) { toast({ title: "Foto muito grande", description: "Máximo 12 MB.", variant: "destructive" }); return; }
    const r = new FileReader();
    r.onloadend = () => setRecorte(r.result as string);
    r.readAsDataURL(f);
  };

  const opcao = "flex items-center gap-3 w-full rounded-xl px-3.5 h-12 text-[14px] font-bold transition-transform duration-100 active:scale-[0.97]";
  return (
    <>
      <Folha aberta={aberta && !recorte} onFechar={onFechar} titulo="Sua foto" sub="Aparece no ranking, nas competições e no X1.">
        <div className="flex flex-col gap-2">
          <button type="button" className={opcao} style={{ background: "#141416" }} onClick={() => camera.current?.click()} disabled={foto.isPending}>
            <Camera className="w-5 h-5" style={{ color: COR.ouro }} /> Tirar foto
          </button>
          <button type="button" className={opcao} style={{ background: "#141416" }} onClick={() => galeria.current?.click()} disabled={foto.isPending}>
            <ImagePlus className="w-5 h-5" style={{ color: COR.ouro }} /> Escolher foto
          </button>
          {(temFoto || atual) && (
            <button type="button" className={opcao} style={{ color: COR.coral }} disabled={foto.isPending}
              onClick={() => aplicar({ tipo: "remover" }, "Foto removida")}>
              <Trash2 className="w-5 h-5" /> Remover foto
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2.5">
          <p className="text-[10.5px] font-black tracking-[.16em]" style={{ color: COR.apagado }}>OU USE UM AVATAR VANT</p>
          <AvatarVantPicker atual={atual} disabled={foto.isPending} onEscolher={(c) => aplicar({ tipo: "avatar", caminho: c }, "Avatar atualizado")} />
        </div>
        <input ref={camera} type="file" accept="image/*" capture="user" className="hidden" onChange={lerArquivo} />
        <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={lerArquivo} />
      </Folha>
      <AvatarCropper open={!!recorte} imageSrc={recorte} onCancel={() => setRecorte(null)}
        onConfirm={(_url, arquivo) => { setRecorte(null); aplicar({ tipo: "arquivo", arquivo }, "Foto atualizada"); }} />
    </>
  );
}
