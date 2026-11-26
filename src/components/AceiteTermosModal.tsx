import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { TextoIa, useResponderConsentimentoIa } from "@/features/consentimento-ia";
import { TERMOS_VERSAO } from "@/shared/lib/termos";

// LGPD: aceite único dos Termos de Uso e da Política de Privacidade.
// Aparece UMA vez por usuário (por versão dos documentos) logo após o login;
// grava versão + data em profiles e nunca mais aparece. Se os documentos
// mudarem de forma relevante, basta subir TERMOS_VERSAO (shared/lib/termos.ts) que todos re-aceitam.
//
// 23/11/2026: a mesma tela pede a permissão de IA de terceiros (App Store 5.1.2(i) + LGPD
// art. 8º: cláusula destacada, nunca genérica). Caixa SEPARADA e DESMARCADA: aceitar os
// Termos não liga a IA. Marcada → consentimento_ia.permitido = true; desmarcada → false.


export default function AceiteTermosModal({ userId }: { userId: string }) {
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [ia, setIa] = useState(false);
  const [verIa, setVerIa] = useState(false);
  const responderIa = useResponderConsentimentoIa(userId);
  const qc = useQueryClient();
  const { pathname } = useLocation();
  // Os links abaixo são <a target="_blank">, e NÃO <Link> do react-router, de
  // propósito: consentimento não pode depender do roteamento interno do app.
  // Abrindo em aba nova, o documento carrega direto do servidor — imune a chunk
  // que falhou no cache, a overlay por cima e a qualquer guarda de rota.
  // O modal e' montado no layout, entao aparece em TODA rota. Sem esta linha, ao
  // clicar em "Termos de Uso" o app navegava certinho... e o modal continuava por
  // cima, tampando a pagina inteira. Do lado do vendedor parecia que o clique nao
  // funcionava. Enquanto ele esta' lendo, o modal sai da frente e volta depois.
  const lendoDocumento = pathname === "/termos" || pathname === "/privacidade";

  useEffect(() => {
    let vivo = true;
    supabase
      .from("profiles")
      .select("termos_aceitos_versao")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return;
        // 25/11 (Rick: "toda hora aparece o pop-up Seus dados com transparência"): a failed read
        // (expired token, no signal — 401s seen in the logs) came back as "no data" and the screen
        // reopened for someone who had already accepted. Unknown = do not ask now. And a NEWER
        // acceptance than this app's version also counts (an older cached app saved its own).
        if (error || !data) return;
        const versao = (data as { termos_aceitos_versao?: string | null }).termos_aceitos_versao;
        setAberto(!versao || versao < TERMOS_VERSAO);
      });
    return () => { vivo = false; };
  }, [userId]);

  const aceitar = async () => {
    setSalvando(true);
    setErro("");
    const { error } = await supabase
      .from("profiles")
      .update({ termos_aceitos_versao: TERMOS_VERSAO, termos_aceitos_em: new Date().toISOString() } as never)
      .eq("user_id", userId);
    if (!error) {
      try { await responderIa.mutateAsync(ia); }
      catch { setSalvando(false); setErro("Não consegui salvar sua escolha sobre a IA — confere a internet e toca de novo."); return; }
      setSalvando(false);
      void qc.invalidateQueries({ queryKey: ["termos-aceitos"] });
      setAberto(false);
      return;
    }
    setSalvando(false);
    // Antes, falha aqui era SILENCIOSA: o botao voltava ao normal e o vendedor
    // clicava pra sempre achando que o app travou. Agora ele sabe o que houve.
    setErro("Não consegui salvar seu aceite — confere a internet e toca de novo.");
  };

  // iPhone (23/11): the login field stayed focused under this screen, so the keyboard flashed
  // open and shut over it. Drop the focus as soon as the screen shows.
  useEffect(() => {
    if (aberto && !lendoDocumento) (document.activeElement as HTMLElement | null)?.blur?.();
  }, [aberto, lendoDocumento]);

  if (!aberto || lendoDocumento) return null;

  return (
    // pointerEvents "auto" A FORCA: quando o popup de teste expirado (Radix
    // Dialog) esta aberto embaixo, o Radix desliga os cliques do <body> inteiro
    // (pointer-events: none) — e este modal, desenhado POR CIMA, ficava bonito
    // e MORTO: o vendedor via "Li e aceito", clicava, e nada. Preso entre os
    // dois. Reativar os cliques so' nesta camada resolve sem mexer no paywall.
    <div
      className="fixed inset-0 z-[95] bg-background/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      style={{ pointerEvents: "auto" }}
    >
      <div className="w-full max-w-md rounded-2xl bg-card border border-border p-5 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Seus dados, com transparência</h2>
            <p className="text-xs text-muted-foreground">Só precisa aceitar uma vez.</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Publicamos os{" "}
          <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-primary underline">Termos de Uso</a> e a{" "}
          <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-primary underline">Política de Privacidade</a>{" "}
          da Vant, explicando quais dados usamos, pra quê, e os seus direitos (incluindo excluir a
          conta quando quiser). Pra continuar, confirme que leu e concorda com os Termos.
        </p>
        <p className="text-xs text-muted-foreground">
          Os documentos abrem numa aba nova — esta tela continua aqui, esperando você voltar.
        </p>
        <div className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
          <p className="text-[11px] font-black tracking-[.14em] text-primary">INTELIGÊNCIA ARTIFICIAL</p>
          <p className="text-sm text-muted-foreground leading-snug">
            Mentor, dicas, relatórios, clima, leitura de nota e de extrato usam IA da <b className="text-foreground">Anthropic</b>{" "}
            e da <b className="text-foreground">OpenAI</b>, que recebem dados como suas vendas, metas, gastos, mensagens e as fotos que você escolher. Sem a sua autorização, nada é enviado e só essas funções ficam desligadas.
          </p>
          <label className="flex items-start gap-2.5 text-sm text-foreground cursor-pointer">
            <input type="checkbox" checked={ia} onChange={(e) => setIa(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" />
            <span>Autorizo a VANT a enviar meus dados a essas empresas de IA pra usar essas funções.</span>
          </label>
          {verIa ? <TextoIa /> : (
            <button type="button" onClick={() => setVerIa(true)} className="text-xs text-primary underline underline-offset-2">Ver o que é enviado e pra quem</button>
          )}
        </div>
        {erro && <p className="text-xs text-destructive font-medium">{erro}</p>}
        <Button className="w-full h-11" onClick={aceitar} disabled={salvando}>
          {salvando ? "Salvando…" : erro ? "Tentar de novo" : "Concordo e continuar"}
        </Button>
      </div>
    </div>
  );
}
