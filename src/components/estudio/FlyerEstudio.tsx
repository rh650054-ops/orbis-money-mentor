import { useEffect, useRef, useState } from "react";
import { X, Download, Loader2, Lock, ImagePlus, Sparkles } from "lucide-react";
import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useToast } from "@/shared/ui/use-toast";

// FLYER ESTÚDIO — cria promoção/flyer PROFISSIONAL usando a FOTO REAL do produto.
// Nada de imagem gerada por IA: a foto é a do vendedor (de preferência a que o Orbis
// Foto já melhorou) e o design (tipografia, preço, faixa) é montado por cima em HTML/CSS
// e "achatado" pra PNG em alta (3x). Assim NUNCA fica com cara de IA — é design de verdade
// com o produto real, que é o que o cliente compra.

const sb = supabase as any;

// Paletas de cor (fundo + destaque). Cor do texto do selo escolhida pra contraste.
const CORES = [
  { id: "dourado", nome: "Dourado", bg: "#0E0E10", accent: "#F5B400", accentText: "#111111" },
  { id: "vermelho", nome: "Vermelho", bg: "#160A0A", accent: "#E11D2A", accentText: "#FFFFFF" },
  { id: "verde", nome: "Verde", bg: "#08130C", accent: "#16A34A", accentText: "#FFFFFF" },
  { id: "roxo", nome: "Roxo", bg: "#120A1A", accent: "#7C3AED", accentText: "#FFFFFF" },
] as const;

const TEMPLATES = [
  { id: "oferta", nome: "Oferta" },
  { id: "combo", nome: "Destaque" },
  { id: "clean", nome: "Clean" },
] as const;

type CorId = (typeof CORES)[number]["id"];
type TemplateId = (typeof TEMPLATES)[number]["id"];

async function urlParaDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const r = await fetch(src, { cache: "no-store" });
  const blob = await r.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("leitura"));
    fr.readAsDataURL(blob);
  });
}

// Reduz a foto que o vendedor eventualmente troca (<=1280px) pra não pesar o export.
async function comprimirFoto(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => resolve(null);
      i.src = url;
    });
    if (!img || !img.width) return null;
    const max = 1280;
    const sc = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * sc));
    c.height = Math.max(1, Math.round(img.height * sc));
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function aplicarMarcaDagua(pngDataUrl: string): Promise<string> {
  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = pngDataUrl;
  });
  if (!img) return pngDataUrl;
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext("2d");
  if (!ctx) return pngDataUrl;
  ctx.drawImage(img, 0, 0);
  const texto = "ORBIS · VERSÃO DE TESTE";
  const fonte = Math.round(img.width * 0.05);
  ctx.font = `bold ${fonte}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.translate(img.width / 2, img.height / 2);
  ctx.rotate(-Math.PI / 6);
  const passoX = ctx.measureText(texto).width + fonte * 1.6;
  const passoY = fonte * 3.2;
  const alcance = Math.max(img.width, img.height);
  for (let y = -alcance; y < alcance; y += passoY) {
    for (let x = -alcance; x < alcance; x += passoX) {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillText(texto, x + 2, y + 2);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText(texto, x, y);
    }
  }
  ctx.restore();
  return c.toDataURL("image/png");
}

export default function FlyerEstudio({ userId, fotoInicial, onClose }: { userId: string; fotoInicial: string; onClose: () => void }) {
  const { toast } = useToast();
  const { status, loading: subLoading } = useSubscription(userId);
  const assinante = status.subscribed;
  const pagante = status.subscribed && status.status !== "trial";

  const [fotoData, setFotoData] = useState<string | null>(null);
  const [chamada, setChamada] = useState("OFERTA IMPERDÍVEL");
  const [produto, setProduto] = useState("");
  const [precoPrefixo, setPrecoPrefixo] = useState("A partir de");
  const [preco, setPreco] = useState("");
  const [contato, setContato] = useState("");
  const [cor, setCor] = useState<CorId>("dourado");
  const [template, setTemplate] = useState<TemplateId>("oferta");
  const [exportando, setExportando] = useState(false);

  const flyerRef = useRef<HTMLDivElement>(null);
  const paleta = CORES.find((c) => c.id === cor) ?? CORES[0];

  // Foto vira data URL (senão o toPng quebra por CORS ao ler a imagem de outro domínio).
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const d = await urlParaDataUrl(fotoInicial);
        if (vivo) setFotoData(d);
      } catch { if (vivo) setFotoData(fotoInicial); }
    })();
    return () => { vivo = false; };
  }, [fotoInicial]);

  // Pré-preenche produto e contato com o que já está no perfil do vendedor.
  useEffect(() => {
    sb.from("profiles").select("what_i_sell, whatsapp_public, instagram, phone, nickname")
      .eq("user_id", userId).maybeSingle()
      .then(({ data }: { data: Record<string, string | null> | null }) => {
        if (!data) return;
        setProduto((p) => p || (data.what_i_sell || "").toString().slice(0, 40));
        const zap = data.whatsapp_public || data.phone || "";
        const insta = data.instagram ? `@${String(data.instagram).replace(/^@/, "")}` : "";
        setContato((c) => c || [zap, insta].filter(Boolean).join("  ·  "));
      });
  }, [userId]);

  const trocarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const d = await comprimirFoto(f);
    if (!d) { toast({ title: "Não consegui ler essa imagem", variant: "destructive" }); return; }
    setFotoData(d);
  };

  const baixar = async () => {
    if (!flyerRef.current || !fotoData) return;
    setExportando(true);
    try {
      let png = await toPng(flyerRef.current, { pixelRatio: 3, cacheBust: true });
      if (!pagante) png = await aplicarMarcaDagua(png);
      const a = document.createElement("a");
      a.href = png;
      a.download = `flyer-${(produto || "orbis").toLowerCase().replace(/\s+/g, "-")}.png`;
      a.click();
      toast({
        title: pagante ? "Flyer baixado!" : "Flyer baixado (com marca d'água)",
        description: pagante
          ? "PNG em alta resolução, pronto pro WhatsApp/Instagram ou pra imprimir."
          : "No teste grátis sai com marca d'água. Assinando, baixa limpo.",
      });
    } catch {
      toast({ title: "Não consegui exportar", description: "Tenta de novo.", variant: "destructive" });
    } finally {
      setExportando(false);
    }
  };

  const precoView = preco.trim() ? `R$ ${preco.trim()}` : "R$ 00,00";

  return (
    <div className="fixed inset-0 z-[80] bg-background overflow-y-auto">
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 min-h-[3.5rem] border-b border-border/60 bg-background/95 backdrop-blur safe-top">
        <div>
          <span className="font-bold text-sm tracking-[0.12em] text-primary">CRIAR FLYER</span>
          <p className="text-xs text-muted-foreground">Sua foto real + design profissional</p>
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
            Monte flyers de promoção com a foto REAL do seu produto e design profissional — sem aquela
            cara de imagem feita por IA. Assine o Orbis e libere.
          </p>
        </div>
      ) : (
        <div className="max-w-md mx-auto p-4 space-y-4 pb-safe">
          {/* ===== PREVIEW DO FLYER (é isso que vira PNG) ===== */}
          <div className="mx-auto w-full max-w-[340px]">
            <div
              ref={flyerRef}
              style={{ width: "100%", aspectRatio: "4 / 5", position: "relative", overflow: "hidden", background: paleta.bg, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}
            >
              {fotoData ? renderTemplate(template, paleta, fotoData, { chamada, produto, precoPrefixo, precoView, contato }) : (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Loader2 className="w-6 h-6 animate-spin text-white/70" />
                </div>
              )}
            </div>
          </div>

          {/* trocar a foto (opcional) */}
          <label className="flex items-center justify-center gap-2 h-10 rounded-xl border border-dashed border-border text-xs text-muted-foreground cursor-pointer hover:border-primary/50 transition-colors">
            <ImagePlus className="w-4 h-4" /> Trocar a foto do produto
            <input type="file" accept="image/*" className="hidden" onChange={trocarFoto} />
          </label>

          {/* modelos + cores */}
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => setTemplate(t.id)}
                className={`h-9 rounded-xl border text-xs font-medium transition-colors ${template === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                {t.nome}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {CORES.map((c) => (
              <button key={c.id} type="button" onClick={() => setCor(c.id)} aria-label={c.nome}
                className={`flex-1 h-9 rounded-xl border-2 transition-transform ${cor === c.id ? "border-primary scale-105" : "border-border"}`}
                style={{ background: c.accent }} />
            ))}
          </div>

          {/* textos */}
          <div className="space-y-3">
            <Field label="Chamada" value={chamada} onChange={(v) => setChamada(v.slice(0, 28))} placeholder="OFERTA IMPERDÍVEL" />
            <Field label="Produto" value={produto} onChange={(v) => setProduto(v.slice(0, 40))} placeholder="Tortinha de limão" />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Antes do preço" value={precoPrefixo} onChange={(v) => setPrecoPrefixo(v.slice(0, 20))} placeholder="A partir de" />
              <Field label="Preço" value={preco} onChange={(v) => setPreco(v.slice(0, 10))} placeholder="9,90" />
            </div>
            <Field label="Contato" value={contato} onChange={(v) => setContato(v.slice(0, 60))} placeholder="WhatsApp · @seuinsta" />
          </div>

          {!pagante && (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-3">
              <p className="text-xs text-muted-foreground">
                No teste grátis o flyer baixa com a marca d'água do Orbis. Assinando, baixa limpo em alta.
              </p>
            </div>
          )}

          <Button onClick={baixar} disabled={exportando || !fotoData} className="w-full h-11 bg-gradient-primary">
            {exportando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {pagante ? "Baixar flyer" : "Baixar com marca d'água"}
          </Button>
          <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Foto real + design de verdade — sem cara de IA.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11" />
    </div>
  );
}

type Dados = { chamada: string; produto: string; precoPrefixo: string; precoView: string; contato: string };
type Paleta = (typeof CORES)[number];

// Cada template é design VETORIAL/CSS por cima da foto real — profissional, sem cara de IA.
function renderTemplate(id: TemplateId, p: Paleta, foto: string, d: Dados) {
  if (id === "combo") {
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <img src={foto} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.05) 35%, rgba(0,0,0,.35) 70%, rgba(0,0,0,.82) 100%)" }} />
        {/* faixa diagonal */}
        <div style={{ position: "absolute", top: "6%", left: "-16%", width: "56%", transform: "rotate(-14deg)", background: p.accent, color: p.accentText, textAlign: "center", fontWeight: 800, fontSize: "4.2%", letterSpacing: ".08em", padding: "2.5% 0", boxShadow: "0 6px 18px rgba(0,0,0,.35)" }}>
          {d.chamada || "OFERTA"}
        </div>
        {/* selo de preço circular */}
        <div style={{ position: "absolute", right: "6%", bottom: "20%", width: "40%", aspectRatio: "1", borderRadius: "50%", background: p.accent, color: p.accentText, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 22px rgba(0,0,0,.4)", border: "3px solid rgba(255,255,255,.85)" }}>
          <span style={{ fontSize: "3.4%", fontWeight: 600, opacity: .9 }}>{d.precoPrefixo}</span>
          <span style={{ fontSize: "9%", fontWeight: 900, lineHeight: 1 }}>{d.precoView}</span>
        </div>
        <div style={{ position: "absolute", left: "6%", right: "6%", bottom: "6%" }}>
          <p style={{ color: "#fff", fontWeight: 900, fontSize: "8.5%", lineHeight: 1.02, textTransform: "uppercase", margin: 0, textShadow: "0 2px 10px rgba(0,0,0,.6)" }}>{d.produto || "Seu produto"}</p>
          {d.contato && <p style={{ color: "#fff", opacity: .9, fontSize: "3.6%", marginTop: "3%", fontWeight: 600 }}>{d.contato}</p>}
        </div>
      </div>
    );
  }
  if (id === "clean") {
    return (
      <div style={{ position: "absolute", inset: 0, background: "#faf7f2", display: "flex", flexDirection: "column", padding: "8%" }}>
        <div style={{ textAlign: "center" }}>
          <span style={{ display: "inline-block", color: p.accent, fontWeight: 800, letterSpacing: ".18em", fontSize: "3.4%", textTransform: "uppercase" }}>{d.chamada || "Novidade"}</span>
        </div>
        <div style={{ marginTop: "5%", borderRadius: 14, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,.14)", flex: 1 }}>
          <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
        <div style={{ textAlign: "center", marginTop: "6%" }}>
          <p style={{ color: "#1a1a1a", fontWeight: 800, fontSize: "7%", margin: 0, textTransform: "uppercase", letterSpacing: ".01em" }}>{d.produto || "Seu produto"}</p>
          <div style={{ width: "16%", height: 3, background: p.accent, margin: "3% auto", borderRadius: 2 }} />
          <p style={{ margin: 0, color: "#555", fontSize: "3.6%", fontWeight: 600 }}>{d.precoPrefixo}</p>
          <p style={{ margin: 0, color: p.accent, fontWeight: 900, fontSize: "10%", lineHeight: 1 }}>{d.precoView}</p>
          {d.contato && <p style={{ marginTop: "4%", color: "#777", fontSize: "3.2%", fontWeight: 600 }}>{d.contato}</p>}
        </div>
      </div>
    );
  }
  // ===== "oferta" (padrão): foto em cima, faixa de design embaixo =====
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "60%" }}>
        <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "38%", background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${p.bg} 100%)` }} />
        <div style={{ position: "absolute", top: "6%", left: "6%", background: p.accent, color: p.accentText, fontWeight: 800, fontSize: "3.6%", letterSpacing: ".08em", padding: "1.8% 3.2%", borderRadius: 999, textTransform: "uppercase" }}>
          {d.chamada || "Oferta"}
        </div>
      </div>
      <div style={{ position: "absolute", left: "6%", right: "6%", top: "58%", bottom: "6%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <p style={{ color: "#fff", fontWeight: 900, fontSize: "9%", lineHeight: 1.02, margin: 0, textTransform: "uppercase" }}>{d.produto || "Seu produto"}</p>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "5%", gap: "4%" }}>
          <div style={{ background: p.accent, color: p.accentText, borderRadius: 14, padding: "3% 5%", boxShadow: "0 8px 22px rgba(0,0,0,.4)" }}>
            <span style={{ display: "block", fontSize: "3.4%", fontWeight: 700, opacity: .9 }}>{d.precoPrefixo}</span>
            <span style={{ display: "block", fontSize: "9.5%", fontWeight: 900, lineHeight: 1 }}>{d.precoView}</span>
          </div>
          {d.contato && <p style={{ color: "#fff", opacity: .85, fontSize: "3.4%", fontWeight: 600, textAlign: "right", maxWidth: "44%", margin: 0 }}>{d.contato}</p>}
        </div>
      </div>
    </div>
  );
}
