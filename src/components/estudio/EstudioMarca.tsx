import { useEffect, useRef, useState } from "react";
import { X, Sparkles, Download, Loader2, Lock } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { generatePixPayload } from "@/shared/lib/pix-code";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useToast } from "@/shared/ui/use-toast";

// ESTÚDIO DE MARCA (Fase "Cremo"): o vendedor responde poucas perguntas, a IA gera a
// ARTE do produto, e o app monta o adesivo premium com textos reais e QR PIX QUE
// FUNCIONA (gerado pelo mesmo motor do app — IA nunca desenha o QR nem os textos,
// senão sai QR quebrado e letra errada). Exporta PNG em qualidade de gráfica (3x).
// Só assinantes — é argumento de venda do plano.

const sb = supabase as any;

type Estilo = "premium" | "rose" | "vibrante";
const ESTILOS: { id: Estilo; nome: string; accent: string; accentSoft: string }[] = [
  { id: "premium", nome: "Ouro", accent: "#E9C46A", accentSoft: "#F5D78E" },
  { id: "rose", nome: "Rosé", accent: "#E76F8E", accentSoft: "#F5A3B7" },
  { id: "vibrante", nome: "Vibrante", accent: "#4ECDC4", accentSoft: "#9BF0EA" },
];

export default function EstudioMarca({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { toast } = useToast();
  const { status, loading: subLoading } = useSubscription(userId);
  const assinante = status.subscribed;

  const [marca, setMarca] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [sabor, setSabor] = useState("");
  const [descricaoIA, setDescricaoIA] = useState("");
  const [ingredientes, setIngredientes] = useState("");
  const [instagram, setInstagram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [merchantCity, setMerchantCity] = useState("");
  const [valores, setValores] = useState("20, 50, 100");
  const [estilo, setEstilo] = useState<Estilo>("premium");
  const [arte, setArte] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const stickerRef = useRef<HTMLDivElement>(null);

  // Pré-preenche com o que o Orbis já sabe do vendedor
  useEffect(() => {
    sb.from("profiles")
      .select("nickname, instagram, whatsapp_public, phone, pix_key, pix_merchant_name, pix_merchant_city, what_i_sell, city")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }: { data: Record<string, string | null> | null }) => {
        if (!data) return;
        setInstagram((data.instagram || "").replace(/^@/, ""));
        setWhatsapp(data.whatsapp_public || data.phone || "");
        setPixKey(data.pix_key || "");
        setMerchantName(data.pix_merchant_name || data.nickname || "");
        setMerchantCity(data.pix_merchant_city || data.city || "SAO PAULO");
        if (data.what_i_sell) setDescricaoIA(data.what_i_sell);
      });
  }, [userId]);

  const est = ESTILOS.find((e) => e.id === estilo)!;
  const payloadPix = pixKey.trim()
    ? generatePixPayload({ pixKey: pixKey.trim(), merchantName: merchantName || marca || "VENDEDOR", merchantCity: merchantCity || "SAO PAULO" })
    : "";
  const listaValores = valores.split(",").map((v) => v.trim()).filter(Boolean).slice(0, 3);

  const gerarArte = async () => {
    const produto = `${sabor} ${descricaoIA}`.trim() || marca;
    if (!produto) {
      toast({ title: "Me conta o produto", description: "Preencha o sabor/produto pra IA criar a arte.", variant: "destructive" });
      return;
    }
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("estudio-arte", { body: { produto, estilo } });
      const err = (data as any)?.error;
      if (error || err) {
        const msg = err === "limite_diario" ? "Você já gerou bastante arte hoje — amanhã libera de novo."
          : err === "assinatura_necessaria" ? "O Estúdio é exclusivo pra assinantes."
          : "Não consegui gerar agora. Tenta de novo em instantes.";
        toast({ title: "Ops", description: msg, variant: "destructive" });
        return;
      }
      setArte(`data:${(data as any).mime};base64,${(data as any).imagem}`);
    } catch {
      toast({ title: "Falha de conexão", description: "Confere a internet e tenta de novo.", variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  const baixar = async () => {
    if (!stickerRef.current) return;
    setExportando(true);
    try {
      const png = await toPng(stickerRef.current, { pixelRatio: 3, cacheBust: true });
      const a = document.createElement("a");
      a.href = png;
      a.download = `${(marca || "adesivo").toLowerCase().replace(/\s+/g, "-")}-orbis.png`;
      a.click();
      toast({ title: "Arte baixada!", description: "PNG em alta resolução, pronto pra gráfica." });
    } catch {
      toast({ title: "Não consegui exportar", description: "Tenta de novo.", variant: "destructive" });
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-background overflow-y-auto">
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 min-h-[3.5rem] border-b border-border/60 bg-background/95 backdrop-blur safe-top">
        <div>
          <span className="font-bold text-sm tracking-[0.12em] bg-gradient-to-r from-[#C9A84C] to-[#F5D78E] bg-clip-text text-transparent">ESTÚDIO DE MARCA</span>
          <p className="text-[10px] text-muted-foreground -mt-0.5">Sua arte profissional com Pix da confiança</p>
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
            Com o Estúdio você cria em minutos a arte premium da sua marca — com QR Pix de verdade —
            que designers cobram até R$ 80 pra fazer. Assine o Orbis e libere.
          </p>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto p-4 grid md:grid-cols-2 gap-6">
          {/* ===== FORMULÁRIO ===== */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Nome da marca</label>
                <Input value={marca} onChange={(e) => setMarca(e.target.value.slice(0, 14))} placeholder="CREMO" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Sabor / variação</label>
                <Input value={sabor} onChange={(e) => setSabor(e.target.value.slice(0, 18))} placeholder="Morango" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Subtítulo</label>
              <Input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value.slice(0, 34))} placeholder="SHAKE DE MOUSSE PREMIUM" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Produto (pra IA desenhar)</label>
              <Input value={descricaoIA} onChange={(e) => setDescricaoIA(e.target.value.slice(0, 80))} placeholder="shake cremoso de mousse com pedaços de fruta" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Ingredientes (opcional)</label>
              <Input value={ingredientes} onChange={(e) => setIngredientes(e.target.value.slice(0, 160))} placeholder="Leite condensado, creme de leite, morango..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Instagram</label>
                <Input value={instagram} onChange={(e) => setInstagram(e.target.value.replace(/^@/, "").slice(0, 30))} placeholder="suamarca" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wide">WhatsApp</label>
                <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.slice(0, 20))} placeholder="11 90000-0000" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Chave Pix (gera o QR de verdade)</label>
              <Input value={pixKey} onChange={(e) => setPixKey(e.target.value.slice(0, 77))} placeholder="celular, e-mail, CPF ou aleatória" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Valores sugeridos</label>
                <Input value={valores} onChange={(e) => setValores(e.target.value.slice(0, 20))} placeholder="20, 50, 100" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Estilo</label>
                <div className="flex gap-1.5 mt-1">
                  {ESTILOS.map((s) => (
                    <button key={s.id} onClick={() => setEstilo(s.id)}
                      className={`flex-1 h-9 rounded-lg text-xs font-semibold border transition-colors ${estilo === s.id ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}>
                      {s.nome}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button onClick={gerarArte} disabled={gerando} className="w-full h-11 bg-gradient-primary">
              {gerando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando sua arte…</> : <><Sparkles className="w-4 h-4 mr-2" /> {arte ? "Gerar outra arte" : "Gerar arte com IA"}</>}
            </Button>
            <Button onClick={baixar} disabled={exportando || !marca} variant="outline" className="w-full h-11">
              {exportando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Baixar PNG pra gráfica (alta resolução)
            </Button>
            <p className="text-[11px] text-muted-foreground">
              O QR é um Pix REAL gerado pelo Orbis com a sua chave — o cliente escaneia e escolhe o valor. A IA cria só a imagem do produto; textos e QR são montados com precisão.
            </p>
          </div>

          {/* ===== PREVIEW DO ADESIVO ===== */}
          <div className="flex justify-center">
            <div
              ref={stickerRef}
              style={{
                width: 400, background: "#0a0705", color: "#fff",
                borderRadius: "170px 170px 30px 30px", padding: 5,
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              <div style={{ border: `1.5px solid ${est.accent}66`, borderRadius: "166px 166px 26px 26px", padding: "34px 20px 22px", textAlign: "center" }}>
                {/* coroa + marca */}
                <div style={{ fontSize: 20, color: est.accent, lineHeight: 1 }}>♛</div>
                <div style={{
                  fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 52, fontWeight: 700, letterSpacing: 2,
                  background: `linear-gradient(135deg, ${est.accent}, ${est.accentSoft}, ${est.accent})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.05, marginTop: 2,
                }}>
                  {(marca || "SUA MARCA").toUpperCase()}
                </div>
                {subtitulo && <div style={{ fontSize: 11, letterSpacing: 5, color: "#ddd", marginTop: 4 }}>{subtitulo.toUpperCase()}</div>}

                {/* sabor */}
                {sabor && (
                  <div style={{ marginTop: 12 }}>
                    <span style={{ fontSize: 22, letterSpacing: 6, color: est.accentSoft, fontWeight: 600 }}>{sabor.toUpperCase()}</span>
                    <div style={{ display: "inline-block", marginLeft: 8, background: est.accent, color: "#0a0705", fontSize: 9, fontWeight: 800, letterSpacing: 2, padding: "3px 10px", borderRadius: 4, verticalAlign: "middle" }}>PREMIUM</div>
                  </div>
                )}

                {/* arte da IA */}
                <div style={{ marginTop: 12, borderRadius: 14, overflow: "hidden", border: `1px solid ${est.accent}44`, height: 190, background: "#151008", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {arte
                    ? <img src={arte} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
                    : <span style={{ fontSize: 12, color: "#8a7b55" }}>A arte da IA aparece aqui ✨</span>}
                </div>

                {/* contatos */}
                <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 12, fontSize: 11.5, color: "#eee" }}>
                  {instagram && <span>◎ @{instagram}</span>}
                  {whatsapp && <span>✆ {whatsapp}</span>}
                </div>

                {/* ingredientes */}
                {ingredientes && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, letterSpacing: 4, color: est.accent, fontWeight: 700 }}>INGREDIENTES</div>
                    <div style={{ fontSize: 11, color: "#ccc", lineHeight: 1.5, marginTop: 3 }}>{ingredientes}</div>
                  </div>
                )}

                {/* Pague com confiança + QR real */}
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, textAlign: "left" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: est.accent, letterSpacing: 1, lineHeight: 1.2 }}>PAGUE COM<br />CONFIANÇA</div>
                    <div style={{ fontSize: 9.5, color: "#ccc", marginTop: 4, lineHeight: 1.4 }}>ESCANEIE E ESCOLHA<br />O VALOR QUE QUISER</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      {listaValores.map((v) => (
                        <span key={v} style={{ background: est.accent, color: "#0a0705", fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 4 }}>R$ {v}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 8.5, color: "#999", marginTop: 4, letterSpacing: 1 }}>OU OUTRO VALOR</div>
                  </div>
                  <div style={{ background: "#fff", padding: 7, borderRadius: 10 }}>
                    {payloadPix
                      ? <QRCodeSVG value={payloadPix} size={118} level="M" />
                      : <div style={{ width: 118, height: 118, display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 10, textAlign: "center" }}>Preencha a<br />chave Pix</div>}
                  </div>
                </div>

                <div style={{ marginTop: 14, fontSize: 10, letterSpacing: 3, color: est.accent, fontWeight: 700 }}>♥ OBRIGADO PELA CONFIANÇA!</div>
                <div style={{ marginTop: 6, fontSize: 8, letterSpacing: 2, color: "#665c40" }}>FEITO COM AMOR · PRODUTO ARTESANAL · ORBIS</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
