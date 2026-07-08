import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Radar, Navigation, Clock, Users, Sparkles, Loader2, TrafficCone, Zap, Calendar } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Slider } from "@/shared/ui/slider";
import { Badge } from "@/shared/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import SpotMap from "@/components/spotfinder/SpotMap";
import SpotFeedback from "@/components/spotfinder/SpotFeedback";

type Spot = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance_km: number;
  spot_type?: "avenida" | "cruzamento" | "shopping" | "terminal" | "centro" | "outro";
  semaforo_duracao?: "longo" | "medio" | "curto" | "desconhecido";
  peak_morning?: string;
  peak_afternoon?: string;
  weekend_better?: boolean;
  traffic_level?: "alto" | "medio" | "baixo";
  best_hours?: string;
  audience_profile?: "nobre" | "media" | "popular" | "misto";
  customer_type?: string;
  score?: number;
  reason?: string;
  recommended_product?: string;
  feedback_summary?: { good: number; medium: number; bad: number; total: number } | null;
};

const trafficColor: Record<string, string> = {
  alto: "bg-destructive/20 text-destructive border-destructive/40",
  medio: "bg-warning/20 text-warning border-warning/40",
  baixo: "bg-success/20 text-success border-success/40",
};

const semaforoLabel: Record<string, string> = {
  longo: "🟥 Sinal longo (>60s)",
  medio: "🟧 Sinal médio",
  curto: "🟨 Sinal curto",
  desconhecido: "❔ Sinal não medido",
};

const spotTypeLabel: Record<string, string> = {
  avenida: "🛣️ Avenida",
  cruzamento: "✚ Cruzamento",
  shopping: "🛍️ Shopping",
  terminal: "🚌 Terminal",
  centro: "🏙️ Centro",
  outro: "📍 Outro",
};

const audienceLabel: Record<string, string> = {
  nobre: "💎 Região nobre",
  media: "🏙️ Classe média",
  popular: "🚌 Popular",
  misto: "🔀 Misto",
};

export default function SpotFinder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [radius, setRadius] = useState([5]);
  const [productContext, setProductContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [cached, setCached] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("city, state")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.city) setCity(data.city);
        if (data?.state) setState(data.state);
      });
  }, [user]);

  const search = async (force = false) => {
    if (!city || !state) {
      toast({ title: "Preencha cidade e estado", variant: "destructive" });
      return;
    }
    setLoading(true);
    setSpots([]);
    try {
      const { data, error } = await supabase.functions.invoke("find-good-spots", {
        body: { city, state, radius_km: radius[0], product_context: productContext, force_refresh: force },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSpots(data?.spots ?? []);
      setCenter(data?.center ? { lat: data.center.lat, lng: data.center.lng } : null);
      setCached(!!data?.cached);
      if ((data?.spots ?? []).length === 0) {
        toast({ title: "Nenhum ponto encontrado", description: "Tente aumentar o raio." });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message ?? "Falha ao buscar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 pb-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Radar className="w-6 h-6" /> Caça-Sinal
          </h1>
          <p className="text-xs text-muted-foreground">
            Avenidas, cruzamentos e picos de trânsito + feedback de outros vendedores
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Cidade</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Porto Alegre" />
            </div>
            <div>
              <Label className="text-xs">UF</Label>
              <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} maxLength={2} placeholder="RS" />
            </div>
          </div>

          <div>
            <Label className="text-xs">O que você vende? (ajuda a IA)</Label>
            <Input
              value={productContext}
              onChange={(e) => setProductContext(e.target.value)}
              placeholder="Ex: água, balas, perfumes importados..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Raio de busca</Label>
              <span className="text-xs text-primary font-semibold">{radius[0]} km</span>
            </div>
            <Slider value={radius} onValueChange={setRadius} min={1} max={20} step={1} />
          </div>

          <Button onClick={() => search(false)} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Radar className="w-4 h-4 mr-2" />}
            {loading ? "Caçando sinais bons..." : "Encontrar bons sinais"}
          </Button>
          {cached && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Resultados do cache (24h)</p>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => search(true)} disabled={loading}>
                Forçar nova busca
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="flex flex-col items-center py-12 gap-3">
          <Sparkles className="w-8 h-8 text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground text-center px-4">
            Analisando avenidas, cruzamentos, picos de trânsito e feedback dos outros vendedores…
          </p>
        </div>
      )}

      {!loading && center && spots.length > 0 && (
        <SpotMap
          center={center}
          spots={spots.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, score: s.score }))}
          onSelect={(id) => {
            setHighlighted(id);
            document.getElementById(`spot-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      )}

      <div className="space-y-3">
        {spots.map((s, i) => (
          <Card
            key={s.id}
            id={`spot-${s.id}`}
            className={`overflow-hidden transition-[colors,transform,opacity] ${highlighted === s.id ? "ring-2 ring-primary" : ""}`}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-lg font-bold text-primary">#{i + 1}</span>
                    {typeof s.score === "number" && (
                      <Badge className="bg-primary/20 text-primary border-primary/40">
                        ⭐ {s.score.toFixed(1)}/10
                      </Badge>
                    )}
                    {s.spot_type && (
                      <Badge variant="outline" className="text-xs">
                        {spotTypeLabel[s.spot_type]}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-base leading-tight">{s.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3 shrink-0" /> {s.address}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">distância</p>
                  <p className="font-semibold text-sm">{s.distance_km} km</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {s.traffic_level && (
                  <Badge className={trafficColor[s.traffic_level]}>
                    🚦 Fluxo {s.traffic_level}
                  </Badge>
                )}
                {s.semaforo_duracao && s.semaforo_duracao !== "desconhecido" && (
                  <Badge variant="outline" className="border-muted text-xs">
                    {semaforoLabel[s.semaforo_duracao]}
                  </Badge>
                )}
                {s.audience_profile && (
                  <Badge variant="outline" className="border-muted text-xs">
                    {audienceLabel[s.audience_profile]}
                  </Badge>
                )}
                {s.weekend_better && (
                  <Badge className="bg-primary/20 text-primary border-primary/40 text-xs">
                    <Calendar className="w-3 h-3 mr-1" /> Melhor fim de semana
                  </Badge>
                )}
              </div>

              {(s.peak_morning || s.peak_afternoon) && (
                <div className="bg-card/40 rounded-lg p-2 space-y-1 border border-border/40">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <TrafficCone className="w-3 h-3" /> Picos de trânsito
                  </p>
                  {s.peak_morning && (
                    <p className="text-xs">🌅 <span className="text-muted-foreground">Manhã:</span> {s.peak_morning}</p>
                  )}
                  {s.peak_afternoon && (
                    <p className="text-xs">🌆 <span className="text-muted-foreground">Tarde:</span> {s.peak_afternoon}</p>
                  )}
                </div>
              )}

              {s.best_hours && (
                <div className="text-sm flex items-start gap-2">
                  <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span><span className="text-muted-foreground">Melhores horários:</span> {s.best_hours}</span>
                </div>
              )}
              {s.customer_type && (
                <div className="text-sm flex items-start gap-2">
                  <Users className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span>{s.customer_type}</span>
                </div>
              )}
              {s.recommended_product && (
                <div className="text-sm flex items-start gap-2">
                  <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span><span className="text-muted-foreground">Vende bem aqui:</span> {s.recommended_product}</span>
                </div>
              )}
              {s.reason && (
                <p className="text-xs text-muted-foreground italic bg-primary/5 rounded-md px-2 py-1.5">
                  {s.reason}
                </p>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`,
                    "_blank",
                  )
                }
              >
                <Navigation className="w-4 h-4 mr-2" />
                Abrir rota no Google Maps
              </Button>

              <SpotFeedback
                placeId={s.id}
                placeName={s.name}
                city={city}
                state={state}
                summary={s.feedback_summary ?? null}
                onChange={() => search(false)}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && spots.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Preencha sua cidade e toque em <strong>Encontrar bons sinais</strong>.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
