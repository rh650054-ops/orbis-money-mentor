import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Save, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Emojis exclusivos do Orbis Ranking
const EXCLUSIVE_EMOJIS = [
  { emoji: "🦁", name: "Leão", description: "Rei da Selva" },
  { emoji: "🐺", name: "Lobo", description: "Estrategista" },
  { emoji: "🦅", name: "Águia", description: "Visão Total" },
  { emoji: "🔥", name: "Fogo", description: "Imparável" },
  { emoji: "⚡", name: "Raio", description: "Velocidade" },
  { emoji: "💎", name: "Diamante", description: "Valor Puro" },
  { emoji: "🚀", name: "Foguete", description: "Decolando" },
  { emoji: "👑", name: "Coroa", description: "Realeza" },
  { emoji: "🎯", name: "Alvo", description: "Focado" },
  { emoji: "💪", name: "Força", description: "Poder" },
  { emoji: "🏆", name: "Troféu", description: "Campeão" },
  { emoji: "⭐", name: "Estrela", description: "Brilhante" },
  { emoji: "🐉", name: "Dragão", description: "Lendário" },
  { emoji: "🦈", name: "Tubarão", description: "Predador" },
  { emoji: "🐯", name: "Tigre", description: "Feroz" },
  { emoji: "🦊", name: "Raposa", description: "Esperto" },
];

interface RankingProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentNickname: string;
  currentAvatar: string;
  onProfileUpdated: () => void;
}

export function RankingProfileModal({
  open,
  onOpenChange,
  userId,
  currentNickname,
  currentAvatar,
  onProfileUpdated
}: RankingProfileModalProps) {
  const { toast } = useToast();
  const [nickname, setNickname] = useState(currentNickname);
  const [selectedEmoji, setSelectedEmoji] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNickname(currentNickname);
    // Check if current avatar is an emoji
    const emojiMatch = EXCLUSIVE_EMOJIS.find(e => e.emoji === currentAvatar);
    if (emojiMatch) {
      setSelectedEmoji(currentAvatar);
    } else {
      setSelectedEmoji("");
    }
  }, [currentNickname, currentAvatar, open]);

  const handleSave = async () => {
    if (!nickname.trim()) {
      toast({
        title: "Erro",
        description: "Digite um nome para o ranking.",
        variant: "destructive"
      });
      return;
    }

    if (nickname.trim().length > 20) {
      toast({
        title: "Erro",
        description: "Nome deve ter no máximo 20 caracteres.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          nickname: nickname.trim(),
          avatar_url: selectedEmoji || null
        })
        .eq("user_id", userId);

      if (profileError) throw profileError;

      // Update leaderboard_stats
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { error: leaderboardError } = await supabase
        .from("leaderboard_stats")
        .update({
          nome_usuario: nickname.trim(),
          avatar_url: selectedEmoji || null
        })
        .eq("user_id", userId)
        .eq("mes_referencia", currentMonth);

      // Ignore leaderboard error if record doesn't exist yet

      toast({
        title: "Perfil atualizado!",
        description: "Seu nome e avatar do ranking foram salvos."
      });

      onProfileUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o perfil.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Personalizar Ranking
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Nome do Ranking */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Nome no Ranking</Label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Seu nome de guerreiro"
              maxLength={20}
              className="bg-background/50 border-border/50"
            />
            <p className="text-xs text-muted-foreground">
              {nickname.length}/20 caracteres
            </p>
          </div>

          {/* Emojis Exclusivos */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <span>Avatar Exclusivo</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                ORBIS
              </span>
            </Label>
            
            <div className="grid grid-cols-4 gap-2">
              {EXCLUSIVE_EMOJIS.map((item) => (
                <button
                  key={item.emoji}
                  type="button"
                  onClick={() => setSelectedEmoji(selectedEmoji === item.emoji ? "" : item.emoji)}
                  className={cn(
                    "relative p-3 rounded-xl transition-all duration-200 group",
                    "hover:scale-105 active:scale-95",
                    selectedEmoji === item.emoji
                      ? "bg-gradient-to-br from-purple-500/30 to-pink-500/30 border-2 border-purple-500 shadow-lg shadow-purple-500/20"
                      : "bg-card/50 border border-border/50 hover:border-purple-500/50"
                  )}
                >
                  <span className="text-2xl block text-center">{item.emoji}</span>
                  <span className={cn(
                    "absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity",
                    "text-muted-foreground"
                  )}>
                    {item.name}
                  </span>
                </button>
              ))}
            </div>

            {selectedEmoji && (
              <p className="text-xs text-muted-foreground text-center mt-4">
                {EXCLUSIVE_EMOJIS.find(e => e.emoji === selectedEmoji)?.description}
              </p>
            )}
          </div>

          {/* Preview */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
            <p className="text-xs text-muted-foreground mb-2 text-center">Preview</p>
            <div className="flex items-center gap-3 justify-center">
              {selectedEmoji ? (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl shadow-lg shadow-purple-500/30">
                  {selectedEmoji}
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-purple-500/30">
                  {(nickname || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-lg font-semibold">{nickname || 'Seu Nome'}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
