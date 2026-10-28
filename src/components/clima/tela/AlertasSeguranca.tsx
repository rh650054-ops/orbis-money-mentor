/* 7 · ALERTAS E SEGURANÇA — alerta OFICIAL do INMET (o mesmo que a Defesa Civil
   usa) primeiro; depois o que os modelos apontam. Com alerta, o card sobe pra
   logo depois do hero (a página cuida disso); coral só com risco real e o pulso
   sutil só quando é grave. Sem alerta: uma linha "✓ Nenhum alerta ativo". */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Share2, ShieldAlert, Siren } from "lucide-react";
import type { AlertaOficial, Tempo } from "@/hooks/useClima";
import { toast } from "@/shared/hooks/use-toast";
import { BotaoAcao, COR, Cartao, Folha, Rotulo, Titulo } from "./comum";

const COR_ALERTA = { vermelho: "#FF5C5C", laranja: "#FF9F43", amarelo: "#F5B800" } as const;
const hora = (s: string) => (s.length >= 16 ? `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 16).replace(":", "h")}` : s);

export function AlertasSeguranca({ t, cidade }: { t: Tempo; cidade: string }) {
  const navigate = useNavigate();
  const [detalhe, setDetalhe] = useState<AlertaOficial | null>(null);
  const oficial = (t.oficiais ?? [])[0] ?? null;
  const modelo = t.alerta;

  if (!oficial && !modelo) {
    // sem alerta: uma linha só, sem card grande
    return (
      <p className="flex items-center gap-2 px-1 text-[14px] font-semibold" style={{ color: COR.sub }} aria-label="Alertas e segurança">
        <CheckCircle2 className="w-[18px] h-[18px] shrink-0" strokeWidth={2.2} style={{ color: "#3DD68C" }} />
        Nenhum alerta ativo <span className="font-normal" style={{ color: COR.mute }}>· INMET e 6 modelos</span>
      </p>
    );
  }

  const nivel = oficial?.nivel ?? (/tempestade/i.test(modelo?.titulo ?? "") ? "vermelho" : "laranja");
  const grave = nivel !== "amarelo";
  const cor = COR_ALERTA[nivel];
  const titulo = oficial ? `INMET emitiu alerta de ${oficial.tipo.toLowerCase()} para sua região` : modelo!.titulo;
  const compartilhar = async () => {
    const txt = `⚠️ ${titulo}${cidade ? ` (${cidade})` : ""}${oficial ? ` · até ${hora(oficial.fim)}` : ""}. ${grave ? "Procura abrigo e evita deslocamento." : "Fica atento."} — via VANT`;
    try {
      if (navigator.share) await navigator.share({ text: txt });
      else { await navigator.clipboard.writeText(txt); toast({ title: "Alerta copiado", description: "É só colar no WhatsApp." }); }
    } catch { /* cancelou */ }
  };

  return (
    <section aria-label="Alertas e segurança">
      <Titulo>Alertas e segurança</Titulo>
      <Cartao className={grave ? "alerta-pulso" : undefined} style={{ borderColor: `${cor}88`, background: `linear-gradient(160deg, ${cor}26, #0e0e10 65%)` }}>
        {grave && <style>{"@keyframes alerta-pulso { 0%,100% { box-shadow: 0 0 0 0 rgba(255,107,94,0) } 50% { box-shadow: 0 0 0 5px rgba(255,107,94,.14) } } .alerta-pulso { animation: alerta-pulso 2.4s ease-in-out infinite } @media (prefers-reduced-motion: reduce) { .alerta-pulso { animation: none } }"}</style>}
        <div className="flex gap-3">
          <span className="w-10 h-10 rounded-[12px] shrink-0 flex items-center justify-center" style={{ background: `${cor}26` }}>
            {grave ? <ShieldAlert className="w-6 h-6" style={{ color: cor }} strokeWidth={2.2} /> : <AlertTriangle className="w-6 h-6" style={{ color: cor }} strokeWidth={2.2} />}
          </span>
          <div className="min-w-0">
            <Rotulo cor={cor}>{grave ? "Alerta importante" : "Atenção"}</Rotulo>
            <p className="text-[17px] font-bold leading-snug mt-1" style={{ color: COR.texto }}>{titulo}</p>
            <p className="text-[13px] mt-1" style={{ color: COR.sub }}>
              {oficial ? `${oficial.severidade} · ${hora(oficial.inicio)} até ${hora(oficial.fim)}` : modelo!.texto}
            </p>
          </div>
        </div>
        {grave && (
          <ul className="mt-3 flex flex-col gap-1">
            {["Procura abrigo", "Pausa a venda", "Evita deslocamento agora"].map((x) => (
              <li key={x} className="text-[15px] font-bold flex items-center gap-2" style={{ color: COR.texto }}><i className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />{x}</li>
            ))}
          </ul>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <BotaoAcao onClick={() => (oficial ? setDetalhe(oficial) : toast({ title: modelo!.titulo, description: modelo!.texto }))}>Detalhes</BotaoAcao>
          <BotaoAcao tom={grave ? "coral" : "neutro"} onClick={() => navigate("/defcon")}><Siren className="w-4 h-4" />Defcon</BotaoAcao>
          <BotaoAcao onClick={() => void compartilhar()}><Share2 className="w-4 h-4" />Enviar</BotaoAcao>
        </div>
      </Cartao>

      <Folha open={!!detalhe} onOpenChange={(o) => { if (!o) setDetalhe(null); }} titulo={detalhe ? `${detalhe.tipo} · ${detalhe.severidade}` : ""}
        subtitulo={detalhe ? `${hora(detalhe.inicio)} até ${hora(detalhe.fim)} · fonte: INMET` : undefined}>
        {detalhe && (
          <>
            {detalhe.riscos && <p className="text-[15px] leading-snug" style={{ color: COR.texto }}>{detalhe.riscos}</p>}
            <ul className="flex flex-col gap-2">
              {detalhe.instrucoes.map((x) => <li key={x} className="text-[14px] leading-snug" style={{ color: COR.sub }}>• {x}</li>)}
            </ul>
            <p className="text-[13px]" style={{ color: COR.mute }}>Emergência: Defesa Civil 199 · Bombeiros 193.</p>
          </>
        )}
      </Folha>
    </section>
  );
}
