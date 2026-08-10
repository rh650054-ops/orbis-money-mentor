import { useEffect, useRef, useState } from "react";
import { X, Sparkles, Download, Loader2, Lock, ArrowLeft, Move, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { generatePixPayload } from "@/shared/lib/pix-code";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useToast } from "@/shared/ui/use-toast";

// ESTÚDIO DE MARCA v3 — biblioteca de MODELOS alimenta a IA:
// 1) o vendedor escolhe um modelo de referência na galeria (estudio_modelos);
// 2) responde POUCAS perguntas (marca, produto, cores, extra);
// 3) a IA gera o adesivo completo NAQUELE estilo, deixando uma área branca
//    reservada, e o vendedor ARRASTA o QR Pix REAL pra cima dela;
// 4) baixa o PNG achatado em alta resolução, pronto pra gráfica.
// O QR nunca é desenhado pela IA (sairia quebrado) — é gerado pelo motor Pix do Orbis.
// Visual: segue DESIGN.md (tokens, sem gradiente em texto, floor text-xs).

const sb = supabase as any;

interface Modelo { id: string; slug: string; nome: string; descricao: string; imagem_url: string | null; }

const FRASES_GERANDO = [
  "Lendo o estilo que você escolheu…",
  "Desenhando a sua marca…",
  "Caprichando nas cores…",
  "Escrevendo o nome sem erro de português…",
  "Reservando o espaço do QR Pix…",
  "Últimos retoques de designer…",
];

export default function EstudioMarca({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { toast } = useToast();
  const { status, loading: subLoading } = useSubscription(userId);
  const assinante = status.subscribed;

  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [modelo, setModelo] = useState<Modelo | null>(null);
  const [marca, setMarca] = useState("");
  const [produto, setProduto] = useState("");
  const [cores, setCores] = useState("");
  const [extras, setExtras] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [merchantCity, setMerchantCity] = useState("");
  const [arte, setArte] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [fraseIdx, setFraseIdx] = useState(0);
  const [exportando, setExportando] = useState(false);

  // QR arrastável sobre a arte (posição em % pra sobreviver ao redimensionamento)
  const [qrPos, setQrPos] = useState({ x: 62, y: 68 }); // canto inferior direito (área reservada)
  const [qrTam, setQrTam] = useState(26); // % da largura
  const artRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ ativo: boolean; offX: number; offY: number }>({ ativo: false, offX: 0, offY: 0 });

  const passo = arte ? 3 : modelo ? 2 : 1;

  useEffect(() => {
    sb.from("estudio_modelos").select("id, slug, nome, descricao, imagem_url").eq("ativo", true).order("ordem")
      .then(({ data }: { data: Modelo[] | null }) => setModelos(data || []));
    sb.from("profiles").select("nickname, pix_key, pix_merchant_name, pix_merchant_city, what_i_sell, city")
      .eq("user_id", userId).maybeSingle()
      .then(({ data }: { data: Record<string, string | null> | null }) => {
        if (!data) return;
        setPixKey(data.pix_key || "");
        setMerchantName(data.pix_merchant_name || data.nickname || "");
        setMerchantCity(data.pix_merchant_city || data.city || "SAO PAULO");
        if (data.what_i_sell) setProduto(data.what_i_sell);
      });
  }, [userId]);

  // Mensagens de progresso enquanto a IA desenha (a geração leva 30–60s)
  useEffect(() => {
    if (!gerando) { setFraseIdx(0); return; }
    const t = setInterval(() => setFraseIdx((i) => Math.min(i + 1, FRASES_GERANDO.length - 1)), 8000);
    return () => clearInterval(t);
  }, [gerando]);

  const payloadPix = pixKey.trim()
    ? generatePixPayload({ pixKey: pixKey.trim(), merchantName: merchantName || marca || "VENDEDOR", merchantCity: merchantCity || "SAO PAULO" })
    : "";

  const gerar = async () => {
    if (!modelo || !marca.trim() || !produto.trim()) {
      toast({ title: "Faltou pouco", description: "Escolha um modelo e preencha marca e produto.", variant: "destructive" });
      return;
    }
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("estudio-arte", {
        body: { modelo_id: modelo.id, marca: marca.trim(), produto: produto.trim(), cores: cores.trim(), extras: extras.trim() },
      });
      const err = (data as any)?.error;
      if (error || err) {
        const msg = err === "limite_diario" ? "Você já gerou bastante arte hoje — amanhã libera de novo."
          : err === "assinatura_necessaria" ? "O Estúdio é exclusivo pra assinantes."
          : "Não consegui gerar agora. Tenta de novo em instantes.";
        toast({ title: "Ops", description: msg, variant: "destructive" });
        return;
      }
      setArte(`data:${(data as any).mime};base64,${(data as any).imagem}`);
      setQrPos({ x: 62, y: 68 });
    } catch {
      toast({ title: "Falha de conexão", description: "Confere a internet e tenta de novo.", variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  // arrastar o QR (mouse e toque)
  const iniciarDrag = (e: React.PointerEvent) => {
    if (!artRef.current) return;
    const r = artRef.current.getBoundingClientRect();
    dragRef.current = {
      ativo: true,
      offX: ((e.clientX - r.left) / r.width) * 100 - qrPos.x,
      offY: ((e.clientY - r.top) / r.height) * 100 - qrPos.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const moverDrag = (e: React.PointerEvent) => {
    if (!dragRef.current.ativo || !artRef.current) return;
    const r = artRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100 - dragRef.current.offX;
    const y = ((e.clientY - r.top) / r.height) * 100 - dragRef.current.offY;
    setQrPos({ x: Math.min(100 - qrTam, Math.max(0, x)), y: Math.min(96, Math.max(0, y)) });
  };
  const soltarDrag = () => { dragRef.current.ativo = false; };

  const baixar = async () => {
    if (!artRef.current) return;
    setExportando(true);
    try {
      const png = await toPng(artRef.current, { pixelRatio: 3, cacheBust: true });
      const a = document.createElement("a");
      a.href = png;
      a.download = `${(marca || "adesivo").toLowerCase().replace(/\s+/g, "-")}-orbis.png`;
      a.click();
      toast({ title: "Arte baixada!", description: "PNG em alta resolução com seu QR Pix real, pronto pra gráfica." });
    } catch {
      toast({ title: "Não consegui exportar", description: "Tenta de novo.", variant: "destructive" });
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-background overflow-y-auto">
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 min-h-[3.5rem] border-b border-border/60 bg-background/95 backdrop-blur safe-top">
        <div className="flex items-center gap-2">
          {(modelo || arte) && (
            <Button variant="ghost" size="icon" onClick={() => (arte ? setArte(null) : setModelo(null))} aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <span className="font-bold text-sm tracking-[0.12em] text-primary">ESTÚDIO DE MARCA</span>
            <p className="text-xs text-muted-foreground">
              {arte ? "Posicione seu QR Pix e baixe" : modelo ? "Me conta sobre a sua marca" : "Escolha um estilo de adesivo"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1" aria-label={`Passo ${passo} de 3`}>
            {passo}/3
          </span>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></Button>
        </div>
      </header>

      {/* Overlay de geração — a espera vira experiência, não tela travada */}
      {gerando && (
        <div className="fixed inset-0 z-[90] bg-background/95 backdrop-blur-sm flex items-center justify-center p-6" role="status" aria-live="polite">
          <div className="max-w-xs w-full text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
            <div>
              <p className="text-lg font-bold">Criando sua arte</p>
              <p className="text-sm text-muted-foreground mt-1">{FRASES_GERANDO[fraseIdx]}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Leva até 1 minuto — a IA desenha tudo do zero no estilo {modelo?.nome ?? "escolhido"}.
            </p>
          </div>
        </div>
      )}

      {!subLoading && !assinante ? (
        <div className="max-w-md mx-auto px-6 py-16 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Exclusivo pra assinantes</h2>
          <p className="text-sm text-muted-foreground">
            Com o Estúdio você cria em minutos a arte da sua marca com QR Pix de verdade — coisa que
            designers cobram até R$ 80 pra fazer. Assine o Orbis e libere.
          </p>
        </div>
      ) : arte ? (
        /* ===== PASSO 3: arte gerada + QR real arrastável ===== */
        <div className="max-w-md mx-auto p-4 space-y-4 pb-safe">
          <div
            ref={artRef}
            className="relative w-full rounded-2xl overflow-hidden select-none border border-border shadow-lg"
            style={{ touchAction: "none" }}
          >
            <img src={arte} alt="Adesivo gerado" className="w-full block" draggable={false} />
            {payloadPix && (
              <div
                onPointerDown={iniciarDrag}
                onPointerMove={moverDrag}
                onPointerUp={soltarDrag}
                role="button"
                aria-label="QR code Pix — arraste para posicionar"
                style={{
                  position: "absolute",
                  left: `${qrPos.x}%`, top: `${qrPos.y}%`, width: `${qrTam}%`,
                  background: "#fff", padding: "3%", borderRadius: 10,
                  cursor: "grab", boxShadow: "0 2px 10px rgba(0,0,0,.35)",
                }}
              >
                <QRCodeSVG value={payloadPix} style={{ width: "100%", height: "100%" }} level="M" />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Move className="w-4 h-4 shrink-0 text-primary" />
              <span className="flex-1">Arrasta o QR pra área branca. Tamanho:</span>
              <input
                type="range" min={16} max={40} value={qrTam}
                onChange={(e) => setQrTam(+e.target.value)}
                className="w-28 accent-primary" aria-label="Tamanho do QR code"
              />
            </div>
            {!payloadPix && (
              <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg p-3">
                Cadastre sua chave Pix no perfil (ou preencha na tela anterior) pro QR real aparecer aqui.
              </div>
            )}
          </div>

          <Button onClick={baixar} disabled={exportando} className="w-full h-11 bg-gradient-primary">
            {exportando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Baixar PNG pra gráfica
          </Button>
          <Button onClick={gerar} disabled={gerando} variant="outline" className="w-full h-11">
            <Sparkles className="w-4 h-4 mr-2" />
            Gerar outra versão
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            O PNG sai em alta resolução (3x), com o QR achatado na arte — é só mandar imprimir.
          </p>
        </div>
      ) : !modelo ? (
        /* ===== PASSO 1: galeria de modelos (alimentada pelo admin) ===== */
        <div className="max-w-2xl mx-auto p-4 pb-safe">
          <div className="rounded-2xl border border-border bg-card p-4 mb-4">
            <p className="text-base font-semibold">Sua marca merece um adesivo profissional</p>
            <p className="text-sm text-muted-foreground mt-1">
              Escolhe um estilo abaixo, responde 4 perguntas e a IA cria uma arte NOVA pra sua marca —
              com espaço pro seu QR Pix de verdade.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {modelos.map((m) => (
              <button
                key={m.id} onClick={() => setModelo(m)}
                className="group text-left rounded-2xl border border-border overflow-hidden bg-card hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              >
                {m.imagem_url && (
                  <div className="relative">
                    <img src={m.imagem_url} alt={m.nome} className="w-full aspect-[3/4] object-cover object-top" loading="lazy" />
                    <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/85 backdrop-blur px-2.5 py-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <Check className="w-3.5 h-3.5" /> Usar estilo
                    </span>
                  </div>
                )}
                <div className="p-3">
                  <p className="text-sm font-semibold">{m.nome}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{m.descricao}</p>
                </div>
              </button>
            ))}
          </div>
          {modelos.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando estilos…
            </div>
          )}
        </div>
      ) : (
        /* ===== PASSO 2: poucas perguntas certeiras ===== */
        <div className="max-w-md mx-auto p-4 space-y-4 pb-safe">
          <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-card p-3">
            {modelo.imagem_url && <img src={modelo.imagem_url} alt="" className="w-14 h-14 rounded-xl object-cover object-top" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{modelo.nome}</p>
              <p className="text-xs text-muted-foreground">Estilo escolhido — a arte vai nascer nesse clima</p>
            </div>
            <Check className="w-5 h-5 text-primary shrink-0" />
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="est-marca" className="text-xs font-medium text-muted-foreground">Qual o nome da sua marca?</label>
              <Input id="est-marca" value={marca} onChange={(e) => setMarca(e.target.value.slice(0, 30))} placeholder="Ex: CREMO" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="est-produto" className="text-xs font-medium text-muted-foreground">O que você vende? (descreve pro desenho)</label>
              <Input id="est-produto" value={produto} onChange={(e) => setProduto(e.target.value.slice(0, 140))} placeholder="Ex: shake cremoso de mousse de morango" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="est-cores" className="text-xs font-medium text-muted-foreground">Cores da sua marca (opcional)</label>
              <Input id="est-cores" value={cores} onChange={(e) => setCores(e.target.value.slice(0, 80))} placeholder="Ex: preto com dourado / rosa e branco" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="est-extras" className="text-xs font-medium text-muted-foreground">Algum detalhe especial? (opcional)</label>
              <Input id="est-extras" value={extras} onChange={(e) => setExtras(e.target.value.slice(0, 200))} placeholder="Ex: uma coroa em cima do nome" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="est-pix" className="text-xs font-medium text-muted-foreground">Sua chave Pix (pro QR real)</label>
              <Input id="est-pix" value={pixKey} onChange={(e) => setPixKey(e.target.value.slice(0, 77))} placeholder="celular, e-mail, CPF ou aleatória" className="h-11" />
            </div>
          </div>

          <Button onClick={gerar} disabled={gerando} className="w-full h-11 bg-gradient-primary">
            <Sparkles className="w-4 h-4 mr-2" /> Gerar meu adesivo
          </Button>
          <p className="text-xs text-muted-foreground">
            A IA cria a arte no estilo escolhido e deixa um espaço em branco — depois você encaixa o
            QR Pix REAL da sua chave (gerado pelo Orbis, escaneável garantido) e baixa pronto pra imprimir.
          </p>
        </div>
      )}
    </div>
  );
}
