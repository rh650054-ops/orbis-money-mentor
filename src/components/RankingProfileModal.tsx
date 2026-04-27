import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Save, Sparkles, Camera, X, Loader2, Instagram, MessageCircle, MapPin, Package, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const EXCLUSIVE_EMOJIS = [
  { emoji: "🦁", name: "Leão" }, { emoji: "🐺", name: "Lobo" },
  { emoji: "🦅", name: "Águia" }, { emoji: "🔥", name: "Fogo" },
  { emoji: "⚡", name: "Raio" }, { emoji: "💎", name: "Diamante" },
  { emoji: "🚀", name: "Foguete" }, { emoji: "👑", name: "Coroa" },
  { emoji: "🎯", name: "Alvo" }, { emoji: "💪", name: "Força" },
  { emoji: "🏆", name: "Troféu" }, { emoji: "⭐", name: "Estrela" },
  { emoji: "🐉", name: "Dragão" }, { emoji: "🦈", name: "Tubarão" },
  { emoji: "🐯", name: "Tigre" }, { emoji: "🦊", name: "Raposa" },
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
  open, onOpenChange, userId, currentNickname, currentAvatar, onProfileUpdated,
}: RankingProfileModalProps) {
  const { toast } = useToast();
  const [nickname, setNickname] = useState(currentNickname);
  const [selectedEmoji, setSelectedEmoji] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Public profile fields
  const [bio, setBio] = useState("");
  const [whatISell, setWhatISell] = useState("");
  const [whereISell, setWhereISell] = useState("");
  const [instagram, setInstagram] = useState("");
  const [whatsappPublic, setWhatsappPublic] = useState("");
  const [showInstagram, setShowInstagram] = useState(false);
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [showCity, setShowCity] = useState(true);
  const [city, setCity] = useState<string | null>(null);
  const [stateUF, setStateUF] = useState<string | null>(null);

  useEffect(() => {
    setNickname(currentNickname);
    if (ALL_EMOJI_VALUES.includes(currentAvatar)) {
      setSelectedEmoji(currentAvatar); setPhotoUrl(""); setPhotoPreview("");
    } else if (currentAvatar && currentAvatar.startsWith("http")) {
      setPhotoUrl(currentAvatar); setPhotoPreview(currentAvatar); setSelectedEmoji("");
    } else {
      setSelectedEmoji(""); setPhotoUrl(""); setPhotoPreview("");
    }
  }, [currentNickname, currentAvatar, open]);

  // Carrega campos públicos ao abrir
  useEffect(() => {
    if (!open || !userId) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("bio, what_i_sell, where_i_sell, instagram, whatsapp_public, show_instagram, show_whatsapp, show_city, city, state")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setBio(data.bio || "");
        setWhatISell(data.what_i_sell || "");
        setWhereISell(data.where_i_sell || "");
        setInstagram(data.instagram || "");
        setWhatsappPublic(data.whatsapp_public || "");
        setShowInstagram(!!data.show_instagram);
        setShowWhatsapp(!!data.show_whatsapp);
        setShowCity(data.show_city ?? true);
        setCity(data.city || null);
        setStateUF(data.state || null);
      }
    })();
  }, [open, userId]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Erro", description: "Selecione uma imagem válida.", variant: "destructive" });
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = async () => {
      const totalPixels = img.width * img.height;
      if (totalPixels < 5_000_000) {
        toast({
          title: "Resolução baixa",
          description: `Sua foto tem ${(totalPixels / 1_000_000).toFixed(1)}MP. Use ao menos 5MP.`,
          variant: "destructive",
        });
        URL.revokeObjectURL(objectUrl); return;
      }
      setPhotoPreview(objectUrl); setSelectedEmoji("");
      setIsUploading(true);
      try {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const filePath = `${userId}/avatar.${fileExt}`;
        await supabase.storage.from('avatars').remove([filePath]);
        const { error } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true, contentType: file.type });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        setPhotoUrl(`${urlData.publicUrl}?t=${Date.now()}`);
        toast({ title: "Foto carregada!" });
      } catch {
        toast({ title: "Erro no upload", variant: "destructive" }); setPhotoPreview("");
      } finally { setIsUploading(false); }
    };
    img.onerror = () => { toast({ title: "Erro", variant: "destructive" }); URL.revokeObjectURL(objectUrl); };
    img.src = objectUrl;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemovePhoto = () => { setPhotoUrl(""); setPhotoPreview(""); };

  const handleSelectEmoji = (emoji: string) => {
    if (selectedEmoji === emoji) setSelectedEmoji("");
    else { setSelectedEmoji(emoji); setPhotoUrl(""); setPhotoPreview(""); }
  };

  const getAvatarValue = () => photoUrl || selectedEmoji || null;

  const handleSave = async () => {
    if (!nickname.trim()) {
      toast({ title: "Erro", description: "Digite um nome.", variant: "destructive" }); return;
    }
    if (nickname.trim().length > 20) {
      toast({ title: "Erro", description: "Nome com no máximo 20 caracteres.", variant: "destructive" }); return;
    }
    setIsSaving(true);
    try {
      const avatarValue = getAvatarValue();
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          nickname: nickname.trim(),
          avatar_url: avatarValue,
          bio: bio.trim() || null,
          what_i_sell: whatISell.trim() || null,
          where_i_sell: whereISell.trim() || null,
          instagram: instagram.trim().replace(/^@/, "") || null,
          whatsapp_public: whatsappPublic.replace(/\D/g, "") || null,
          show_instagram: showInstagram,
          show_whatsapp: showWhatsapp,
          show_city: showCity,
        })
        .eq("user_id", userId);

      if (profileError) throw profileError;

      const currentMonth = new Date().toISOString().slice(0, 7);
      await supabase
        .from("leaderboard_stats")
        .update({ nome_usuario: nickname.trim(), avatar_url: avatarValue })
        .eq("user_id", userId)
        .eq("mes_referencia", currentMonth);

      toast({ title: "Perfil salvo!", description: "Outros vendedores já podem ver." });
      onProfileUpdated();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const renderPreviewAvatar = () => {
    if (photoPreview || photoUrl) {
      return (
        <div className="relative">
          <img src={photoPreview || photoUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-primary shadow-lg shadow-primary/30" />
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
              <Loader2 className="w-6 h-6 text-primary-foreground animate-spin" />
            </div>
          )}
        </div>
      );
    }
    if (selectedEmoji) {
      return (
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/50 flex items-center justify-center text-3xl shadow-lg shadow-primary/30">
          {selectedEmoji}
        </div>
      );
    }
    return (
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 border-2 border-primary/50 flex items-center justify-center text-2xl font-bold text-primary shadow-lg shadow-primary/30">
        {(nickname || 'U').charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-primary/30 max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-primary" />
            Personalizar Perfil
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Preview */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2 text-center">Como aparece no ranking</p>
            <div className="flex items-center gap-3 justify-center">
              {renderPreviewAvatar()}
              <span className="text-lg font-semibold text-foreground">{nickname || 'Seu Nome'}</span>
            </div>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Nome no Ranking</Label>
            <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Seu nome" maxLength={20} className="bg-background/50" />
            <p className="text-xs text-muted-foreground">{nickname.length}/20</p>
          </div>

          {/* Foto */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Foto de Perfil
            </Label>
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="border-primary/30">
                {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</> : <><Camera className="w-4 h-4 mr-2" />Escolher Foto</>}
              </Button>
              {(photoPreview || photoUrl) && (
                <Button type="button" variant="ghost" size="sm" onClick={handleRemovePhoto} className="text-destructive">
                  <X className="w-4 h-4 mr-1" /> Remover
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Mínimo 5MP. JPG, PNG ou WEBP.</p>
          </div>

          {/* Emojis */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Ou escolha um avatar Orbis</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {EXCLUSIVE_EMOJIS.map((item) => (
                <button
                  key={item.emoji}
                  type="button"
                  onClick={() => handleSelectEmoji(item.emoji)}
                  className={cn(
                    "p-2 rounded-lg transition-all hover:scale-105 active:scale-95",
                    selectedEmoji === item.emoji
                      ? "bg-primary/20 border-2 border-primary shadow-lg shadow-primary/20"
                      : "bg-card/50 border border-border/50 hover:border-primary/50"
                  )}
                >
                  <span className="text-xl block text-center">{item.emoji}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ===== Perfil Público ===== */}
          <div className="pt-3 border-t border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Perfil Público</h3>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">NOVO</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Outros vendedores podem ver seu perfil pelo ranking. Você decide o que mostrar.</p>

            {/* Bio */}
            <div className="space-y-2 mb-4">
              <Label className="text-xs font-medium">Bio (frase de impacto)</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Ex: Vendedor de rua, foco em resultado."
                maxLength={120}
                rows={2}
                className="bg-background/50 resize-none text-sm"
              />
              <p className="text-[10px] text-muted-foreground text-right">{bio.length}/120</p>
            </div>

            {/* O que vendo */}
            <div className="space-y-2 mb-4">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-primary" />
                O que eu vendo
              </Label>
              <Input
                value={whatISell}
                onChange={(e) => setWhatISell(e.target.value)}
                placeholder="Ex: Açaí, doces, salgados"
                maxLength={80}
                className="bg-background/50 text-sm"
              />
            </div>

            {/* Onde vendo */}
            <div className="space-y-2 mb-4">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-primary" />
                Onde eu vendo
              </Label>
              <Input
                value={whereISell}
                onChange={(e) => setWhereISell(e.target.value)}
                placeholder="Ex: Centro de POA, Praia de Cidreira"
                maxLength={80}
                className="bg-background/50 text-sm"
              />
            </div>

            {/* Cidade visibility */}
            {(city || stateUF) && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-card/40 border border-border/50 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {[city, stateUF].filter(Boolean).join(" / ")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Mostrar minha cidade</p>
                  </div>
                </div>
                <Switch checked={showCity} onCheckedChange={setShowCity} />
              </div>
            )}

            {/* Instagram */}
            <div className="space-y-2 mb-3">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Instagram className="w-3.5 h-3.5 text-primary" />
                Instagram (opcional)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@seuusuario"
                  maxLength={40}
                  className="bg-background/50 text-sm flex-1"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">Mostrar</span>
                  <Switch checked={showInstagram} onCheckedChange={setShowInstagram} />
                </div>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="space-y-2 mb-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-primary" />
                WhatsApp (opcional)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={whatsappPublic}
                  onChange={(e) => setWhatsappPublic(e.target.value)}
                  placeholder="51 99999-9999"
                  maxLength={20}
                  className="bg-background/50 text-sm flex-1"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">Mostrar</span>
                  <Switch checked={showWhatsapp} onCheckedChange={setShowWhatsapp} />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Se ligado, qualquer usuário do app poderá te chamar.</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 sticky bottom-0 bg-card pb-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isUploading}
            className="flex-1 bg-gradient-to-r from-primary to-[hsl(45_100%_38%)] text-primary-foreground font-bold"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
