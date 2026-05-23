import { useEffect, useState } from "react";
import { ThumbsUp, Minus, ThumbsDown, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type Summary = { good: number; medium: number; bad: number; total: number } | null;

interface Props {
  placeId: string;
  placeName: string;
  city: string;
  state: string;
  summary: Summary;
  onChange?: () => void;
}

export default function SpotFeedback({ placeId, placeName, city, state, summary, onChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [myRating, setMyRating] = useState<"bom" | "medio" | "ruim" | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("spot_feedback")
      .select("rating, comment")
      .eq("user_id", user.id)
      .eq("place_id", placeId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setMyRating(data.rating);
          setComment(data.comment ?? "");
        }
      });
  }, [user, placeId]);

  const submit = async (rating: "bom" | "medio" | "ruim") => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("spot_feedback").upsert(
      { user_id: user.id, place_id: placeId, place_name: placeName, city, state, rating, comment: comment || null },
      { onConflict: "user_id,place_id" },
    );
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setMyRating(rating);
    toast({ title: "Valeu pelo feedback!", description: "Ajuda outros vendedores e a IA." });
    onChange?.();
  };

  const total = summary?.total ?? 0;

  return (
    <div className="border-t border-border/40 pt-3 space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-xs"
      >
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <MessageSquare className="w-3.5 h-3.5" />
          {total > 0 ? `${total} vendedor${total > 1 ? "es" : ""} avaliou` : "Seja o 1º a avaliar"}
        </span>
        {total > 0 && (
          <span className="flex items-center gap-2 text-[11px]">
            <span className="text-green-400">👍 {summary!.good}</span>
            <span className="text-yellow-400">😐 {summary!.medium}</span>
            <span className="text-red-400">👎 {summary!.bad}</span>
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-2 pt-1">
          <p className="text-[11px] text-muted-foreground">Como é vender aqui?</p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              size="sm"
              variant={myRating === "bom" ? "default" : "outline"}
              onClick={() => submit("bom")}
              disabled={saving}
              className="text-xs"
            >
              <ThumbsUp className="w-3.5 h-3.5 mr-1" /> Bom
            </Button>
            <Button
              size="sm"
              variant={myRating === "medio" ? "default" : "outline"}
              onClick={() => submit("medio")}
              disabled={saving}
              className="text-xs"
            >
              <Minus className="w-3.5 h-3.5 mr-1" /> Médio
            </Button>
            <Button
              size="sm"
              variant={myRating === "ruim" ? "default" : "outline"}
              onClick={() => submit("ruim")}
              disabled={saving}
              className="text-xs"
            >
              <ThumbsDown className="w-3.5 h-3.5 mr-1" /> Ruim
            </Button>
          </div>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Opcional: dica pros outros (horário bom, perigo, semáforo, etc)"
            rows={2}
            className="text-xs"
            maxLength={300}
          />
          {myRating && comment && (
            <Button size="sm" variant="ghost" onClick={() => submit(myRating)} disabled={saving} className="w-full text-xs">
              {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
              Salvar comentário
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
