import { useCallback, useEffect, useRef, useState } from "react";
import { X, Sparkles, Download, Loader2, Lock, ArrowLeft, Move, Check, ImagePlus, Trash2, Crosshair, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { generatePixPayload } from "@/shared/lib/pix-code";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useToast } from "@/shared/ui/use-toast";

// ESTÚDIO DE MARCA v4 — a arte nasce no CHAT; aqui é o EDITOR do QR:
// 1) (opcional) galeria de modelos + 4 perguntas, pra quem entra por aqui;
// 2) a arte chega pronta (do chat ou da geração) com uma área branca reservada;
// 3) o QR ENCAIXA SOZINHO no quadrado branco (a gente acha ele lendo os pixels);
// 4) o QR pode vir da CHAVE PIX (gerado pelo Orbis, escaneável garantido) OU de uma
//    FOTO/PRINT do QR que o vendedor já tem — dá pra arrastar e redimensionar;
// 5) baixa o PNG achatado em alta resolução (3x), pronto pra gráfica.
// A IA nunca desenha o QR (sairia quebrado) — o QR é sempre real.
// Visual: segue DESIGN.md (tokens, sem gradiente em texto, floor text-xs).

const sb = supabase as any;

interface Modelo { id: string; slug: string; nome: string; descricao: string; imagem_url: string | null; }

// Briefing montado na CONVERSA com a Orbis IA (ferramenta criar_adesivo do cérebro).
// Quando presente, a galeria é pulada: o estilo veio da conversa, e o vendedor ainda
// pode anexar uma foto de referência DELE (inspiração de estilo — a arte sai original).
export interface EstudioBrief { marca?: string; produto?: string; cores?: string; extras?: string; estilo?: string; }

const FRASES_GERANDO = [
  "Lendo o estilo que você escolheu…",
  "Desenhando a sua marca…",
  "Caprichando nas cores…",
  "Escrevendo o nome sem erro de português…",
  "Reservando o espaço do QR Pix…",
  "Últimos retoques de designer…",
];

// ---------------------------------------------------------------------------
// Acha a ÁREA BRANCA reservada na arte (aquele quadradinho que a IA deixa vazio).
// Lê os pixels numa versão pequena da imagem e procura o MAIOR quadrado branco
// (programação dinâmica clássica do "maximal square"). Devolve em % da imagem,
// que é a mesma unidade usada pra posicionar o QR na tela.
// ---------------------------------------------------------------------------
async function acharAreaBranca(src: string): Promise<{ x: number; y: number; tam: number } | null> {
  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = src;
  });
  if (!img || !img.width || !img.height) return null;

  const L = 180; // largura de análise: rápido e mais que suficiente
  const w = L;
  const h = Math.max(1, Math.round((img.height / img.width) * L));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  let px: Uint8ClampedArray;
  try { px = ctx.getImageData(0, 0, w, h).data; } catch { return null; } // canvas "sujo" (CORS)

  // branco = claro nos 3 canais E sem cor dominante (evita pegar amarelo clarinho)
  const branco = (i: number) => {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    return r > 232 && g > 232 && b > 232 && Math.max(r, g, b) - Math.min(r, g, b) < 14;
  };

  const dp = new Int16Array(w * h);
  let melhor = 0, mx = 0, my = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!branco((y * w + x) * 4)) continue;
      const v = (x === 0 || y === 0)
        ? 1
        : Math.min(dp[(y - 1) * w + x], dp[y * w + (x - 1)], dp[(y - 1) * w + (x - 1)]) + 1;
      dp[y * w + x] = v;
      if (v > melhor) { melhor = v; mx = x; my = y; }
    }
  }
  // quadrado pequeno demais = provavelmente um brilho ou letra branca, não a área reservada
  if (melhor < w * 0.09) return null;

  // x/tam são % da LARGURA da arte; y é % da ALTURA (mesmas unidades do CSS)
  const tam = (melhor / w) * 100;
  const x = ((mx - melhor + 1) / w) * 100;
  const y = ((my - melhor + 1) / h) * 100;
  // O QR cobre o quadrado inteiro: o padding de 3% da caixa já faz a margem branca
  // de respiro que o leitor precisa (box-sizing: border-box).
  const tamEmAltura = (melhor / h) * 100; // o mesmo lado, medido em % da altura
  return {
    x: Math.max(0, Math.min(100 - tam, x)),
    y: Math.max(0, Math.min(100 - tamEmAltura, y)),
    tam,
  };
}

// ---------------------------------------------------------------------------
// Prepara a imagem de QR que o vendedor subiu: reduz e CORTA a borda branca
// (print de banco quase sempre vem com margem). Só corta margem uniforme —
// nunca invade o desenho do QR.
// ---------------------------------------------------------------------------
async function prepararQrEnviado(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => resolve(null);
      i.src = url;
    });
    if (!img || !img.width || !img.height) return null;

    const max = 900;
    const sc = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * sc));
    const h = Math.max(1, Math.round(img.height * sc));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);

    let x0 = 0, y0 = 0, x1 = w - 1, y1 = h - 1;
    try {
      const px = ctx.getImageData(0, 0, w, h).data;
      const claro = (i: number) => px[i] > 236 && px[i + 1] > 236 && px[i + 2] > 236;
      const linhaBranca = (y: number) => { for (let x = 0; x < w; x++) if (!claro((y * w + x) * 4)) return false; return true; };
      const colBranca = (x: number) => { for (let y = 0; y < h; y++) if (!claro((y * w + x) * 4)) return false; return true; };
      while (y0 < y1 && linhaBranca(y0)) y0++;
      while (y1 > y0 && linhaBranca(y1)) y1--;
      while (x0 < x1 && colBranca(x0)) x0++;
      while (x1 > x0 && colBranca(x1)) x1--;
    } catch { /* sem leitura de pixel: usa a imagem inteira */ }

    const lw = Math.max(1, x1 - x0 + 1);
    const lh = Math.max(1, y1 - y0 + 1);
    const out = document.createElement("canvas");
    out.width = lw; out.height = lh;
    out.getContext("2d")?.drawImage(c, x0, y0, lw, lh, 0, 0, lw, lh);
    return out.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function EstudioMarca({ userId, onClose, brief, arteInicial }: { userId: string; onClose: () => void; brief?: EstudioBrief | null; arteInicial?: string | null }) {
  const { toast } = useToast();
  const { status, loading: subLoading } = useSubscription(userId);
  const assinante = status.subscribed;

  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [modelo, setModelo] = useState<Modelo | null>(null);
  const [marca, setMarca] = useState(brief?.marca?.slice(0, 30) ?? "");
  const [produto, setProduto] = useState(brief?.produto?.slice(0, 140) ?? "");
  const [cores, setCores] = useState(brief?.cores?.slice(0, 80) ?? "");
  const [extras, setExtras] = useState(brief?.extras?.slice(0, 200) ?? "");
  // Foto de referência anexada pelo PRÓPRIO vendedor (opcional, só inspiração de estilo)
  const [refUser, setRefUser] = useState<{ b64: string; preview: string } | null>(null);
  const [pixKey, setPixKey] = useState("");
  const [pixSalva, setPixSalva] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [merchantCity, setMerchantCity] = useState("");
  // Arte pode chegar pronta do CHAT (a IA gerou na conversa; aqui só encaixa o QR e baixa)
  const [arte, setArte] = useState<string | null>(arteInicial ?? null);
  // Mesma arte convertida pra data URL: sem isso o navegador bloqueia ler os pixels
  // (pra achar a área branca) e exportar o PNG, porque a imagem vem de outro domínio.
  const [arteData, setArteData] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [fraseIdx, setFraseIdx] = useState(0);
  const [exportando, setExportando] = useState(false);

  // De onde vem o QR: da chave Pix (gerado pelo Orbis) ou de uma imagem que ele subiu
  const [qrModo, setQrModo] = useState<"chave" | "imagem">("chave");
  const [qrImg, setQrImg] = useState<string | null>(null);
  const [encaixou, setEncaixou] = useState(false);

  // QR arrastável sobre a arte (posição em % pra sobreviver ao redimensionamento)
  const [qrPos, setQrPos] = useState({ x: 62, y: 68 }); // canto inferior direito (área reservada)
  const [qrTam, setQrTam] = useState(26); // % da largura
  const areaRef = useRef<{ x: number; y: number; tam: number } | null>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ ativo: boolean; offX: number; offY: number }>({ ativo: false, offX: 0, offY: 0 });

  const briefMode = !!brief;
  const totalPassos = arteInicial ? 1 : briefMode ? 2 : 3;
  const passo = arteInicial ? 1 : arte ? totalPassos : briefMode ? 1 : modelo ? 2 : 1;

  useEffect(() => {
    if (!briefMode) {
      sb.from("estudio_modelos").select("id, slug, nome, descricao, imagem_url").eq("ativo", true).order("ordem")
        .then(({ data }: { data: Modelo[] | null }) => setModelos(data || []));
    }
    sb.from("profiles").select("nickname, pix_key, pix_merchant_name, pix_merchant_city, what_i_sell, city")
      .eq("user_id", userId).maybeSingle()
      .then(({ data }: { data: Record<string, string | null> | null }) => {
        if (!data) return;
        setPixKey(data.pix_key || "");
        setPixSalva(data.pix_key || "");
        setMerchantName(data.pix_merchant_name || data.nickname || "");
        setMerchantCity(data.pix_merchant_city || data.city || "SAO PAULO");
        if (data.what_i_sell) setProduto((p) => p || data.what_i_sell || "");
      });
  }, [userId, briefMode]);

  // Baixa a arte e vira data URL (libera leitura de pixels + exportação sem CORS)
  useEffect(() => {
    if (!arte) { setArteData(null); return; }
    if (arte.startsWith("data:")) { setArteData(arte); return; }
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch(arte, { cache: "no-store" });
        const blob = await r.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = () => reject(new Error("leitura"));
          fr.readAsDataURL(blob);
        });
        if (!cancelado) setArteData(dataUrl);
      } catch {
        if (!cancelado) setArteData(arte); // segue mostrando; o encaixe automático fica off
      }
    })();
    return () => { cancelado = true; };
  }, [arte]);

  // Encaixe automático: assim que a arte carrega, o QR vai pro quadrado branco sozinho
  const encaixarNoQuadrado = useCallback(() => {
    const a = areaRef.current;
    if (!a) {
      toast({ title: "Não achei o quadrado branco", description: "Arrasta o QR até ele e ajusta o tamanho — funciona igual." });
      return;
    }
    setQrPos({ x: a.x, y: a.y });
    setQrTam(a.tam);
  }, [toast]);

  useEffect(() => {
    if (!arteData) return;
    let cancelado = false;
    (async () => {
      const a = await acharAreaBranca(arteData);
      if (cancelado || !a) return;
      areaRef.current = a;
      setQrPos({ x: a.x, y: a.y });
      setQrTam(a.tam);
      setEncaixou(true);
    })();
    return () => { cancelado = true; };
  }, [arteData]);

  // Anexa a foto de referência do vendedor: reduz pra <=1024px e comprime (JPEG)
  const onRefFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const max = 1024;
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * sc));
      c.height = Math.max(1, Math.round(img.height * sc));
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/jpeg", 0.85);
      setRefUser({ b64: dataUrl.split(",")[1] || "", preview: dataUrl });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast({ title: "Não consegui ler essa imagem", description: "Tenta outra foto.", variant: "destructive" });
    };
    img.src = url;
  };

  // Sobe a IMAGEM do QR (print do banco, foto do papel, PNG que ele já tem)
  const onQrFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const pronto = await prepararQrEnviado(f);
    if (!pronto) {
      toast({ title: "Não consegui ler essa imagem", description: "Tenta um print ou foto mais nítida do QR.", variant: "destructive" });
      return;
    }
    setQrImg(pronto);
    setQrModo("imagem");
    if (areaRef.current) { setQrPos({ x: areaRef.current.x, y: areaRef.current.y }); setQrTam(areaRef.current.tam); }
    toast({ title: "QR carregado", description: "Encaixei ele no quadrado branco — confere e ajusta se quiser." });
  };

  // Mensagens de progresso enquanto a IA desenha (a geração leva 30–60s)
  useEffect(() => {
    if (!gerando) { setFraseIdx(0); return; }
    const t = setInterval(() => setFraseIdx((i) => Math.min(i + 1, FRASES_GERANDO.length - 1)), 8000);
    return () => clearInterval(t);
  }, [gerando]);

  const payloadPix = pixKey.trim()
    ? generatePixPayload({ pixKey: pixKey.trim(), merchantName: merchantName || marca || "VENDEDOR", merchantCity: merchantCity || "SAO PAULO" })
    : "";
  const temQr = qrModo === "imagem" ? !!qrImg : !!payloadPix;

  // Guarda a chave no perfil pra ele nunca mais digitar
  const salvarPix = async () => {
    const k = pixKey.trim();
    if (!k || k === pixSalva) return;
    try {
      await sb.from("profiles").update({ pix_key: k }).eq("user_id", userId);
      setPixSalva(k);
      toast({ title: "Chave Pix salva", description: "Da próxima vez o QR já vem pronto." });
    } catch { /* não trava o fluxo por causa disso */ }
  };

  const gerar = async () => {
    if (!marca.trim() || !produto.trim() || (!modelo && !brief?.estilo && !refUser)) {
      toast({ title: "Faltou pouco", description: briefMode ? "Preencha marca e produto." : "Escolha um modelo e preencha marca e produto.", variant: "destructive" });
      return;
    }
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("estudio-arte", {
        body: {
          modelo_id: modelo?.id ?? "",
          marca: marca.trim(), produto: produto.trim(), cores: cores.trim(), extras: extras.trim(),
          estilo: brief?.estilo?.slice(0, 300) ?? "",
          ref_b64: refUser?.b64 ?? "",
          ref_mime: refUser ? "image/jpeg" : "",
        },
      });
      const err = (data as any)?.error;
      if (error || err) {
        const msg = err === "limite_diario" ? "Você já gerou bastante arte hoje — amanhã libera de novo."
          : err === "assinatura_necessaria" ? "O Estúdio é exclusivo pra assinantes."
          : "Não consegui gerar agora. Tenta de novo em instantes.";
        toast({ title: "Ops", description: msg, variant: "destructive" });
        return;
      }
      areaRef.current = null;
      setEncaixou(false);
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
    if (!temQr) {
      toast({ title: "Falta o QR", description: "Coloca tua chave Pix ou sobe a imagem do teu QR antes de baixar.", variant: "destructive" });
      return;
    }
    setExportando(true);
    try {
      await salvarPix();
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
          {((arte && !arteInicial) || (!briefMode && modelo)) && (
            <Button variant="ghost" size="icon" onClick={() => (arte ? setArte(null) : setModelo(null))} aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <span className="font-bold text-sm tracking-[0.12em] text-primary">ESTÚDIO DE MARCA</span>
            <p className="text-xs text-muted-foreground">
              {arte ? "Encaixe seu QR Pix e baixe" : briefMode ? "Confere o briefing da conversa e gera" : modelo ? "Me conta sobre a sua marca" : "Escolha um estilo de adesivo"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1" aria-label={`Passo ${passo} de ${totalPassos}`}>
            {passo}/{totalPassos}
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
              Leva até 1 minuto — a IA desenha tudo do zero no estilo {modelo?.nome ?? (briefMode ? "que vocês combinaram" : "escolhido")}.
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
        /* ===== EDITOR: arte pronta + QR real encaixado no quadrado branco ===== */
        <div className="max-w-md mx-auto p-4 space-y-4 pb-safe">
          <div
            ref={artRef}
            className="relative w-full rounded-2xl overflow-hidden select-none border border-border shadow-lg"
            style={{ touchAction: "none" }}
          >
            <img src={arteData ?? arte} alt="Adesivo gerado" className="w-full block" draggable={false} />
            {temQr && (
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
                {qrModo === "imagem" && qrImg ? (
                  <img src={qrImg} alt="Seu QR Pix" style={{ width: "100%", display: "block" }} draggable={false} />
                ) : (
                  <QRCodeSVG value={payloadPix} style={{ width: "100%", height: "100%" }} level="M" />
                )}
              </div>
            )}
          </div>

          {/* Escolha da fonte do QR: chave Pix (recomendado) ou imagem que ele já tem */}
          <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button" onClick={() => setQrModo("chave")}
                className={`h-10 rounded-xl border text-xs font-medium transition-colors ${qrModo === "chave" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
              >
                <QrCode className="w-4 h-4 inline mr-1.5 -mt-0.5" />Gerar da minha chave
              </button>
              <button
                type="button" onClick={() => setQrModo("imagem")}
                className={`h-10 rounded-xl border text-xs font-medium transition-colors ${qrModo === "imagem" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
              >
                <ImagePlus className="w-4 h-4 inline mr-1.5 -mt-0.5" />Subir meu QR
              </button>
            </div>

            {qrModo === "chave" ? (
              <div className="space-y-1.5">
                <label htmlFor="edt-pix" className="text-xs font-medium text-muted-foreground">Sua chave Pix</label>
                <Input
                  id="edt-pix" value={pixKey} onBlur={salvarPix}
                  onChange={(e) => setPixKey(e.target.value.slice(0, 77))}
                  placeholder="celular, e-mail, CPF ou aleatória" className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  {payloadPix
                    ? "QR gerado pelo Orbis — escaneável garantido, com seu nome no comprovante."
                    : "Digita a chave e o QR aparece na hora na arte."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {qrImg ? (
                  <div className="flex items-center gap-3">
                    <img src={qrImg} alt="QR enviado" className="w-14 h-14 rounded-lg bg-white object-contain p-1" />
                    <p className="text-xs text-muted-foreground flex-1">Teu QR entrou na arte. Arrasta e ajusta o tamanho se precisar.</p>
                    <Button variant="ghost" size="icon" onClick={() => setQrImg(null)} aria-label="Remover QR">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-border text-sm text-muted-foreground cursor-pointer hover:border-primary/50 transition-colors">
                    <ImagePlus className="w-4 h-4" /> Escolher a imagem do meu QR
                    <input type="file" accept="image/*" className="hidden" onChange={onQrFile} />
                  </label>
                )}
                <p className="text-xs text-muted-foreground">
                  Serve print do banco ou foto do papel — eu corto a borda branca sozinho. Confere se ele
                  fica nítido antes de imprimir.
                </p>
              </div>
            )}
          </div>

          {/* Ajuste fino */}
          {temQr && (
            <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Move className="w-4 h-4 shrink-0 text-primary" />
                <span className="flex-1">Arrasta o QR na arte. Tamanho:</span>
                <input
                  type="range" min={10} max={50} value={Math.round(qrTam)}
                  onChange={(e) => setQrTam(+e.target.value)}
                  className="w-28 accent-primary" aria-label="Tamanho do QR code"
                />
              </div>
              <Button variant="outline" onClick={encaixarNoQuadrado} className="w-full h-10">
                <Crosshair className="w-4 h-4 mr-2" />
                Encaixar no quadrado branco
              </Button>
              {encaixou && (
                <p className="text-xs text-muted-foreground text-center">
                  Já encaixei ele no espaço reservado — mexe só se quiser.
                </p>
              )}
            </div>
          )}

          <Button onClick={baixar} disabled={exportando || !temQr} className="w-full h-11 bg-gradient-primary">
            {exportando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Baixar PNG pra gráfica
          </Button>
          {(modelo || brief?.estilo || refUser) && (
            <Button onClick={gerar} disabled={gerando} variant="outline" className="w-full h-11">
              <Sparkles className="w-4 h-4 mr-2" />
              Gerar outra versão
            </Button>
          )}
          {arteInicial && !brief && (
            <p className="text-xs text-muted-foreground text-center">
              Quer outra versão? Volta no chat e pede pra IA — ela gera na conversa.
            </p>
          )}
          <p className="text-xs text-muted-foreground text-center">
            O PNG sai em alta resolução (3x), com o QR achatado na arte — é só mandar imprimir.
          </p>
        </div>
      ) : !briefMode && !modelo ? (
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
        /* ===== PASSO 2: poucas perguntas certeiras (ou briefing pronto do chat) ===== */
        <div className="max-w-md mx-auto p-4 space-y-4 pb-safe">
          {modelo ? (
            <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-card p-3">
              {modelo.imagem_url && <img src={modelo.imagem_url} alt="" className="w-14 h-14 rounded-xl object-cover object-top" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{modelo.nome}</p>
                <p className="text-xs text-muted-foreground">Estilo escolhido — a arte vai nascer nesse clima</p>
              </div>
              <Check className="w-5 h-5 text-primary shrink-0" />
            </div>
          ) : brief?.estilo ? (
            <div className="rounded-2xl border border-primary/40 bg-card p-3">
              <p className="text-xs font-medium text-muted-foreground">Estilo combinado na conversa com a Orbis IA</p>
              <p className="text-sm mt-1">{brief.estilo}</p>
            </div>
          ) : null}

          {briefMode && (
            <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Foto de referência (opcional)</p>
              {refUser ? (
                <div className="flex items-center gap-3">
                  <img src={refUser.preview} alt="Referência anexada" className="w-14 h-14 rounded-xl object-cover" />
                  <p className="text-xs text-muted-foreground flex-1">Referência anexada — só inspiração de estilo, sua arte sai nova e única.</p>
                  <Button variant="ghost" size="icon" onClick={() => setRefUser(null)} aria-label="Remover referência">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-border text-sm text-muted-foreground cursor-pointer hover:border-primary/50 transition-colors">
                  <ImagePlus className="w-4 h-4" /> Anexar foto de um adesivo que você curte
                  <input type="file" accept="image/*" className="hidden" onChange={onRefFile} />
                </label>
              )}
            </div>
          )}

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
              <Input id="est-pix" value={pixKey} onBlur={salvarPix} onChange={(e) => setPixKey(e.target.value.slice(0, 77))} placeholder="celular, e-mail, CPF ou aleatória" className="h-11" />
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
