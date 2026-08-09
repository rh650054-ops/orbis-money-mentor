import { useEffect, useRef, useState } from "react";
import { X, Sparkles, Download, Loader2, Lock, ArrowLeft, Move } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { generatePixPayload } from "@/shared/lib/pix-code";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useToast } from "@/shared/ui/use-toast";

// ESTÚDIO DE MARCA v2 — biblioteca de MODELOS alimenta a IA:
// 1) o vendedor escolhe um modelo de referência na galeria (estudio_modelos);
// 2) responde POUCAS perguntas (marca, produto, cores, extra);
// 3) a IA gera o adesivo completo NAQUELE estilo, deixando uma área branca
//    reservada, e o vendedor ARRASTA o QR Pix REAL pra cima dela;
// 4) baixa o PNG achatado em alta resolução, pronto pra gráfica.
// O QR nunca é desenhado pela IA (sairia quebrado) — é gerado pelo motor Pix do Orbis.

const sb = supabase as any;

interface Modelo { id: string; slug: string; nome: string; descricao: string; imagem_url: string | null; }

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
  const [exportando, setExportando] = useState(false);

  // QR arrastável sobre a arte (posição em % pra sobreviver ao redimensionamento)
  const [qrPos, setQrPos] = useState({ x: 62, y: 68 }); // canto inferior direito (área reservada)
  const [qrTam, setQrTam] = useState(26); // % da largura
  const artRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ ativo: boolean; offX: number; offY: number }>({ ativo: false, offX: 0, offY: 0 });

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
            <span className="font-bold text-sm tracking-[0.12em] bg-gradient-to-r from-[#C9A84C] to-[#F5D78E] bg-clip-text text-transparent">ESTÚDIO DE MARCA</span>
            <p className="text-[10px] text-muted-foreground -mt-0.5">
              {arte ? "Posicione seu QR Pix e baixe" : modelo ? "Me conta sobre a sua marca" : "Escolha um modelo de referência"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></Button>
      </header>

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
        <div className="max-w-md mx-auto p-4 space-y-4">
          <div
            ref={artRef}
            className="relative w-full rounded-2xl overflow-hidden select-none"
            style={{ touchAction: "none" }}
          >
            <img src={arte} alt="Adesivo gerado" className="w-full block" draggable={false} />
            {payloadPix && (
              <div
                onPointerDown={iniciarDrag}
                onPointerMove={moverDrag}
                onPointerUp={soltarDrag}
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
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Move className="w-4 h-4 shrink-0" />
            <span className="flex-1">Arrasta o QR pra área branca. Tamanho:</span>
            <input type="range" min={16} max={40} value={qrTam} onChange={(e) => setQrTam(+e.target.value)} className="w-28 accent-primary" />
          </div>
          {!payloadPix && (
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              Cadastre sua chave Pix no perfil (ou preencha na tela anterior) pro QR real aparecer aqui.
            </div>
          )}
          <Button onClick={baixar} disabled={exportando} className="w-full h-11 bg-gradient-primary">
            {exportando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Baixar PNG pra gráfica
          </Button>
          <Button onClick={gerar} disabled={gerando} variant="outline" className="w-full h-10">
            {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Gerar outra versão
          </Button>
        </div>
      ) : !modelo ? (
        /* ===== PASSO 1: galeria de modelos (alimentada pelo admin) ===== */
        <div className="max-w-2xl mx-auto p-4">
          <p className="text-sm text-muted-foreground mb-4">
            Esses são os estilos que a IA sabe fazer. Escolhe o que combina com a tua marca — a arte
            criada vai ser NOVA, só inspirada no modelo.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {modelos.map((m) => (
              <button key={m.id} onClick={() => setModelo(m)}
                className="text-left rounded-2xl border border-border overflow-hidden bg-card hover:border-primary/50 transition-colors">
                {m.imagem_url && <img src={m.imagem_url} alt={m.nome} className="w-full h-44 object-cover object-top" />}
                <div className="p-3">
                  <p className="text-sm font-semibold">{m.nome}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{m.descricao}</p>
                </div>
              </button>
            ))}
          </div>
          {modelos.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Carregando modelos…</p>}
        </div>
      ) : (
        /* ===== PASSO 2: poucas perguntas certeiras ===== */
        <div className="max-w-md mx-auto p-4 space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
            {modelo.imagem_url && <img src={modelo.imagem_url} alt="" className="w-12 h-12 rounded-lg object-cover object-top" />}
            <div>
              <p className="text-xs font-semibold">{modelo.nome}</p>
              <p className="text-[10px] text-muted-foreground">Estilo escolhido</p>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Qual o nome da sua marca?</label>
            <Input value={marca} onChange={(e) => setMarca(e.target.value.slice(0, 30))} placeholder="Ex: CREMO" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wide">O que você vende? (descreve pro desenho)</label>
            <Input value={produto} onChange={(e) => setProduto(e.target.value.slice(0, 140))} placeholder="Ex: shake cremoso de mousse de morango" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Cores da sua marca (opcional)</label>
            <Input value={cores} onChange={(e) => setCores(e.target.value.slice(0, 80))} placeholder="Ex: preto com dourado / rosa e branco" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Algum detalhe especial? (opcional)</label>
            <Input value={extras} onChange={(e) => setExtras(e.target.value.slice(0, 200))} placeholder="Ex: uma coroa em cima do nome / frase 'feito com amor'" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Sua chave Pix (pro QR real)</label>
            <Input value={pixKey} onChange={(e) => setPixKey(e.target.value.slice(0, 77))} placeholder="celular, e-mail, CPF ou aleatória" />
          </div>
          <Button onClick={gerar} disabled={gerando} className="w-full h-11 bg-gradient-primary">
            {gerando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando no estilo {modelo.nome}…</> : <><Sparkles className="w-4 h-4 mr-2" /> Gerar meu adesivo</>}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            A IA cria a arte no estilo escolhido e deixa um espaço em branco — depois você encaixa o
            QR Pix REAL da sua chave (gerado pelo Orbis, escaneável garantido) e baixa pronto pra imprimir.
          </p>
        </div>
      )}
    </div>
  );
}
