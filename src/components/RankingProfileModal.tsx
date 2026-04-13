import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Save, Sparkles, Camera, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

const ALL_EMOJI_VALUES = EXCLUSIVE_EMOJIS.map(e => e.emoji);

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
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNickname(currentNickname);
    if (ALL_EMOJI_VALUES.includes(currentAvatar)) {
      setSelectedEmoji(currentAvatar);
      setPhotoUrl("");
      setPhotoPreview("");
    } else if (currentAvatar && currentAvatar.startsWith("http")) {
      setPhotoUrl(currentAvatar);
      setPhotoPreview(currentAvatar);
      setSelectedEmoji("");
    } else {
      setSelectedEmoji("");
      setPhotoUrl("");
      setPhotoPreview("");
    }
  }, [currentNickname, currentAvatar, open]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Erro", description: "Selecione uma imagem válida.", variant: "destructive" });
      return;
    }

    // Validate minimum resolution (~5MP = 2560x1920 or similar)
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = async () => {
      const totalPixels = img.width * img.height;
      const minPixels = 5_000_000; // 5MP

      if (totalPixels < minPixels) {
        toast({
          title: "Resolução baixa",
          description: `Sua foto tem ${(totalPixels / 1_000_000).toFixed(1)}MP. Use uma foto com pelo menos 5MP para melhor qualidade.`,
          variant: "destructive"
        });
        URL.revokeObjectURL(objectUrl);
        return;
      }

      // Show preview immediately
      setPhotoPreview(objectUrl);
      setSelectedEmoji("");

      // Upload to storage
      setIsUploading(true);
      try {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const filePath = `${userId}/avatar.${fileExt}`;

        // Remove old avatar if exists
        await supabase.storage.from('avatars').remove([filePath]);

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file, { upsert: true, contentType: file.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        // Add cache-busting param
        const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        setPhotoUrl(publicUrl);

        toast({ title: "Foto carregada!", description: "Sua foto foi enviada com sucesso." });
      } catch (error) {
        console.error("Upload error:", error);
        toast({ title: "Erro no upload", description: "Não foi possível enviar a foto.", variant: "destructive" });
        setPhotoPreview("");
      } finally {
        setIsUploading(false);
      }
    };

    img.onerror = () => {
      toast({ title: "Erro", description: "Não foi possível ler a imagem.", variant: "destructive" });
      URL.revokeObjectURL(objectUrl);
    };

    img.src = objectUrl;

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemovePhoto = () => {
    setPhotoUrl("");
    setPhotoPreview("");
  };

  const handleSelectEmoji = (emoji: string) => {
    if (selectedEmoji === emoji) {
      setSelectedEmoji("");
    } else {
      setSelectedEmoji(emoji);
      setPhotoUrl("");
      setPhotoPreview("");
    }
  };

  const getAvatarValue = () => {
    if (photoUrl) return photoUrl;
    if (selectedEmoji) return selectedEmoji;
    return null;
  };

  const handleSave = async () => {
    if (!nickname.trim()) {
      toast({ title: "Erro", description: "Digite um nome para o ranking.", variant: "destructive" });
      return;
    }
    if (nickname.trim().length > 20) {
      toast({ title: "Erro", description: "Nome deve ter no máximo 20 caracteres.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const avatarValue = getAvatarValue();

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ nickname: nickname.trim(), avatar_url: avatarValue })
        .eq("user_id", userId);

      if (profileError) throw profileError;

      const currentMonth = new Date().toISOString().slice(0, 7);
      await supabase
        .from("leaderboard_stats")
        .update({ nome_usuario: nickname.trim(), avatar_url: avatarValue })
        .eq("user_id", userId)
        .eq("mes_referencia", currentMonth);

      toast({ title: "Perfil atualizado!", description: "Seu nome e avatar do ranking foram salvos." });
      onProfileUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({ title: "Erro", description: "Não foi possível salvar o perfil.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const renderPreviewAvatar = () => {
    if (photoPreview || photoUrl) {
      return (
        <div className="relative">
          <img
            src={photoPreview || photoUrl}
            alt="Avatar"
            className="w-16 h-16 rounded-full object-cover shadow-lg shadow-purple-500/30 border-2 border-purple-500"
          />
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>
      );
    }
    if (selectedEmoji) {
      return (
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl shadow-lg shadow-purple-500/30">
          {selectedEmoji}
        </div>
      );
    }
    return (
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-purple-500/30">
        {(nickname || 'U').charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Personalizar Ranking
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* Nome */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Nome no Ranking</Label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Seu nome de guerreiro"
              maxLength={20}
              className="bg-background/50 border-border/50"
            />
            <p className="text-xs text-muted-foreground">{nickname.length}/20 caracteres</p>
          </div>

          {/* Foto */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Foto de Perfil
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">NOVO</span>
            </Label>

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="border-purple-500/30 hover:border-purple-500/60"
              >
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                ) : (
                  <><Camera className="w-4 h-4 mr-2" />Escolher Foto</>
                )}
              </Button>

              {(photoPreview || photoUrl) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemovePhoto}
                  className="text-red-400 hover:text-red-300"
                >
                  <X className="w-4 h-4 mr-1" /> Remover
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Mínimo 5MP para melhor qualidade. JPG, PNG ou WEBP.
            </p>
          </div>

          {/* Emojis */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <span>Ou escolha um Avatar</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">ORBIS</span>
            </Label>

            <div className="grid grid-cols-4 gap-2">
              {EXCLUSIVE_EMOJIS.map((item) => (
                <button
                  key={item.emoji}
                  type="button"
                  onClick={() => handleSelectEmoji(item.emoji)}
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
              {renderPreviewAvatar()}
              <span className="text-lg font-semibold">{nickname || 'Seu Nome'}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isUploading}
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
