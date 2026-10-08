import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/shared/ui/dialog";
import { useAvisoDominioLigadoQuery } from "../api/use-aviso-dominio-query";
import {
  deveMostrarAviso, linkNovoDominio, aparelhoDe, DOMINIO_NOVO, DOMINIOS_ANTIGOS, CHAVE_ADIADO,
} from "../hooks/regra-aviso";

const GOLD = "#F5B800";

function lerAdiado(): number | null {
  try { return Number(localStorage.getItem(CHAVE_ADIADO)) || null; } catch { return null; }
}

const PASSOS_INSTALAR = {
  ios: ["No Safari, toque em Compartilhar (o quadrado com a seta pra cima)", "Escolha \"Adicionar à Tela de Início\"", "Toque em \"Adicionar\""],
  android: ["No Chrome, toque nos 3 pontinhos (⋮) lá em cima", "Escolha \"Instalar app\" ou \"Adicionar à tela inicial\"", "Confirme em \"Instalar\""],
  outro: ["Abra no celular, no Safari (iPhone) ou no Chrome (Android)", "Use \"Adicionar à Tela de Início\" ou \"Instalar app\"", "Pronto: a Vant fica com ícone próprio"],
} as const;

/** "A Vant mudou de endereço" — only on the old address, only after Rick turns it on. */
export function AvisoNovoDominio() {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const noAntigo = DOMINIOS_ANTIGOS.includes(host.toLowerCase());
  const { data: ligado = false } = useAvisoDominioLigadoQuery(noAntigo);
  const [adiadoEm, setAdiadoEm] = useState<number | null>(lerAdiado);

  if (!deveMostrarAviso({ host, ligado, adiadoEm, agora: Date.now() })) return null;

  const passos = PASSOS_INSTALAR[aparelhoDe(typeof navigator !== "undefined" ? navigator.userAgent : "")];
  const adiar = () => {
    const agora = Date.now();
    try { localStorage.setItem(CHAVE_ADIADO, String(agora)); } catch { /* modo privado: some só nesta visita */ }
    setAdiadoEm(agora);
  };

  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto) adiar(); }}>
      <DialogContent className="p-0 gap-0 max-w-[420px] w-[calc(100vw-1.5rem)] max-h-[92dvh] overflow-y-auto border border-primary/30 rounded-2xl [&>button]:hidden" style={{ background: "#000", color: "#F4F1EA" }}>
        <div className="px-5 py-6 space-y-4">
          <p className="font-mono text-[10px] font-bold tracking-[.18em]" style={{ color: GOLD }}>NOVO ENDEREÇO</p>
          <DialogTitle className="text-[24px] font-black leading-[1.1] tracking-[-.02em]">
            A Vant agora mora em <span style={{ color: GOLD }}>{DOMINIO_NOVO}</span>
          </DialogTitle>
          <DialogDescription className="text-[14px]" style={{ color: "#BDB7AA" }}>
            A partir de agora, use sempre o endereço novo. Seus dados, seu ranking e sua assinatura continuam iguais: é só entrar pelo endereço novo com o mesmo e-mail e senha.
          </DialogDescription>

          <div className="rounded-2xl p-4 space-y-2" style={{ background: "#141413", border: "1px solid rgba(255,255,255,.08)" }}>
            <p className="text-[13px] font-extrabold">Depois de abrir, coloque a Vant na tela do celular:</p>
            <ol className="space-y-1.5 text-[13px]" style={{ color: "#BDB7AA" }}>
              {passos.map((p, i) => (
                <li key={p} className="flex gap-2"><b style={{ color: GOLD }}>{i + 1}.</b><span>{p}</span></li>
              ))}
            </ol>
            <p className="text-[12px]" style={{ color: "#827C6E" }}>Se você já tinha o ícone antigo, pode apagar ele depois.</p>
          </div>

          <a href={linkNovoDominio()}
            className="w-full h-[54px] rounded-[16px] inline-flex items-center justify-center text-[15px] font-black active:translate-y-[1px]"
            style={{ background: GOLD, color: "#000" }}>
            Abrir a Vant no endereço novo
          </a>
          <button type="button" onClick={adiar} className="w-full h-10 text-[13px]" style={{ color: "#827C6E" }}>
            Lembrar amanhã
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
