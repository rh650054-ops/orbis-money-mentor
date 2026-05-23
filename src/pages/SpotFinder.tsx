import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Radar, Navigation, Clock, Users, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Spot = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance_km: number;
  traffic_level?: "alto" | "medio" | "baixo";
  best_hours?: string;
  audience_profile?: "nobre" | "media" | "popular" | "misto";
  customer_type?: string;
  score?: number;
  reason?: string;
  recommended_product?: string;
};

const trafficColor: Record<string, string> = {
  alto: "bg-red-500/20 text-red-300 border-red-500/40",
  medio: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  baixo: "bg-green-500/20 text-green-300 border-green-500/40",
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
  const [cached, setCached] = useState(false);

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

  const search = async () => {
    if (!city || !state) {
      toast({ title: "Preencha cidade e estado", variant: "destructive" });
      return;
    }
    setLoading(true);
    setSpots([]);
    try {
      const { data, error } = await supabase.functions.invoke("find-good-spots", {
        body: { city, state, radius_km: radius[0], product_context: productContext },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSpots(data?.spots ?? []);
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
          <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
            <Radar className="w-6 h-6" /> Caça-Sinal
          </h1>
          <p className="text-xs text-muted-foreground">
            Os melhores pontos da sua região pra vender, escolhidos por IA + Google Maps
          </p>
        </div>
      </div>

      <Card className="glass">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Cidade</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="São Paulo" />
            </div>
            <div>
              <Label className="text-xs">UF</Label>
              <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} maxLength={2} placeholder="SP" />
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

          <Button onClick={search} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Radar className="w-4 h-4 mr-2" />}
            {loading ? "Caçando sinais bons..." : "Encontrar bons sinais"}
          </Button>
          {cached && (
            <p className="text-[10px] text-muted-foreground text-center">
              Resultados do cache (atualiza a cada 24h pra economizar)
            </p>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="flex flex-col items-center py-12 gap-3">
          <Sparkles className="w-8 h-8 text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">Analisando avenidas, fluxo e perfil da região…</p>
        </div>
      )}

      <div className="space-y-3">
        {spots.map((s, i) => (
          <Card key={s.id} className="glass overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-primary">#{i + 1}</span>
                    {typeof s.score === "number" && (
                      <Badge className="bg-primary/20 text-primary border-primary/40">
                        ⭐ {s.score.toFixed(1)}/10
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-base leading-tight">{s.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {s.address}
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
                {s.audience_profile && (
                  <Badge variant="outline" className="border-muted">
                    {audienceLabel[s.audience_profile]}
                  </Badge>
                )}
              </div>

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
                  <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span><span className="text-muted-foreground">Vende bem aqui:</span> {s.recommended_product}</span>
                </div>
              )}
              {s.reason && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-2">
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
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && spots.length === 0 && (
        <Card className="glass">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Preencha sua cidade e toque em <strong>Encontrar bons sinais</strong> pra ver os melhores pontos pra vender perto de você.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
