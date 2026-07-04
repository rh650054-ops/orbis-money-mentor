import { useState, useEffect } from "react";
import { getCheckoutUrl } from "@/shared/lib/checkout";
import { useNavigate } from "react-router-dom";
import { Crown, Mail, Calendar, TrendingUp, CheckCircle2, Edit2, Save, X, Camera, ArrowLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { z } from "zod";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useBrazilCities } from "@/shared/hooks/use-brazil-cities";
import { AvatarCropper } from "@/components/AvatarCropper";
import { RankingProfileModal } from "@/components/RankingProfileModal";

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const profileSchema = z.object({
  nickname: z.string()
    .trim()
    .min(1, { message: "Apelido não pode estar vazio" })
    .max(100, { message: "Apelido deve ter no máximo 100 caracteres" }),
  email: z.string()
    .trim()
    .max(255, { message: "E-mail deve ter no máximo 255 caracteres" })
    .optional()
    .or(z.literal("")),
  phone: z.string()
    .trim()
    .refine((v) => {
      const d = v.replace(/\D/g, "");
      return d.length >= 10 && d.length <= 11;
    }, { message: "WhatsApp inválido (DDD + número)" }),
  state: z.string().min(2, { message: "Selecione o estado" }).max(2),
  city: z.string().trim().min(2, { message: "Informe a cidade" }).max(80),
});

export default function Profile() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const { whitelisted: isAdmin, loading: adminLoading } = useAdminAccess(user?.id);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [publicProfileOpen, setPublicProfileOpen] = useState(false);
  const [profile, setProfile] = useState({
    nickname: "",
    email: "",
    created_at: "",
    monthly_goal: 0,
    avatar_url: "",
    is_demo: false,
    billing_exempt: false,
    plan_status: "trial",
    phone: "",
    state: "",
    city: "",
  });
  const [editForm, setEditForm] = useState({
    nickname: "",
    email: "",
    avatar_url: "",
    phone: "",
    state: "",
    city: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  // Meta mensal de lucro líquido (profiles.monthly_goal)
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [stats, setStats] = useState({
    transactions: 0,
    goals: 0,
    insights: 0
  });
  const [isUpgrading] = useState(false);
  const { cities: editCities, loading: loadingEditCities } = useBrazilCities(editForm.state);
  const subscriptionFeatures = [
    "Insights ilimitados da IA",
    "Análises avançadas de gastos",
    "Relatórios personalizados",
    "Metas ilimitadas",
    "Suporte prioritário",
    "Exportação de dados",
  ];

  // Admin NÃO deve ser exibido como "demo" (mesmo tendo is_demo=true só pra isenção de cobrança)
  const isDemo = profile.is_demo && !isAdmin;
  // Usuário BLACK = admin ou assinante ativo → mostra faixa BLACK no topo
  const isBlack = isAdmin || profile.plan_status === "active";

  // Carregar perfil do usuário
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      loadProfile();
      loadStats();
    }
  }, [user, loading, navigate]);

  const loadProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data && !error) {
      setProfile({
        nickname: data.nickname || "",
        email: data.email || "",
        created_at: data.created_at || "",
        monthly_goal: data.monthly_goal || 0,
        avatar_url: data.avatar_url || "",
        is_demo: data.is_demo || false,
        billing_exempt: data.billing_exempt || false,
        plan_status: data.plan_status || "trial",
        phone: data.phone || "",
        state: data.state || "",
        city: data.city || "",
      });
      setEditForm({
        nickname: data.nickname || "",
        email: data.email || "",
        avatar_url: data.avatar_url || "",
        phone: data.phone || "",
        state: data.state || "",
        city: data.city || "",
      });
      if (data.avatar_url) {
        setAvatarPreview(data.avatar_url);
      }
    } else {
      // Se não existe perfil, criar um
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          email: user.email || "",
          nickname: user.email?.split("@")[0] || "Usuário"
        })
        .select()
        .single();

      if (newProfile) {
        setProfile({
          nickname: newProfile.nickname || "",
          email: newProfile.email || "",
          created_at: newProfile.created_at || "",
          monthly_goal: newProfile.monthly_goal || 0,
          avatar_url: newProfile.avatar_url || "",
          is_demo: newProfile.is_demo || false,
          billing_exempt: newProfile.billing_exempt || false,
          plan_status: newProfile.plan_status || "trial",
          phone: newProfile.phone || "",
          state: newProfile.state || "",
          city: newProfile.city || "",
        });
        setEditForm({
          nickname: newProfile.nickname || "",
          email: newProfile.email || "",
          avatar_url: newProfile.avatar_url || "",
          phone: newProfile.phone || "",
          state: newProfile.state || "",
          city: newProfile.city || "",
        });
      }
    }
    setLoadingProfile(false);
  };

  const loadStats = async () => {
    if (!user) return;

    // Contar vendas registradas
    const { count: salesCount } = await supabase
      .from("daily_sales")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    // Contar rotinas
    const { count: routinesCount } = await supabase
      .from("routines")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    // Contar atividades personalizadas
    const { count: activitiesCount } = await supabase
      .from("routine_activities")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    setStats({
      transactions: salesCount || 0,
      goals: routinesCount || 0,
      insights: activitiesCount || 0
    });
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        toast({
          title: "Erro",
          description: "Arquivo muito grande. Máximo 8MB.",
          variant: "destructive"
        });
        return;
      }
      // Abre o editor de recorte (arrastar + zoom) antes de salvar
      const reader = new FileReader();
      reader.onloadend = () => setCropSrc(reader.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const handleCropConfirm = (dataUrl: string, file: File) => {
    setAvatarPreview(dataUrl);
    setAvatarFile(file);
    setCropSrc(null);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      // Validate form data
      const validation = profileSchema.safeParse(editForm);
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        toast({
          title: "Erro de validação",
          description: firstError?.message ?? "Dados inválidos",
          variant: "destructive"
        });
        setIsSaving(false);
        return;
      }

      let finalAvatarUrl = editForm.avatar_url;

      // Upload avatar para o Storage (nunca salvar base64 no banco!)
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop() || "jpg";
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, {
            contentType: avatarFile.type || "image/jpeg",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);
        finalAvatarUrl = publicData.publicUrl;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          nickname: editForm.nickname.trim(),
          email: editForm.email.trim() || null,
          avatar_url: finalAvatarUrl,
          phone: editForm.phone.replace(/\D/g, ""),
          state: editForm.state,
          city: editForm.city.trim(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setProfile({
        ...profile,
        nickname: editForm.nickname,
        email: editForm.email,
        avatar_url: finalAvatarUrl,
        phone: editForm.phone,
        state: editForm.state,
        city: editForm.city,
      });

      setIsEditing(false);
      setAvatarFile(null);
      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram salvas com sucesso.",
      });
      setIsSaving(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o perfil.",
        variant: "destructive"
      });
      setIsSaving(false);
    }
  };

  const handleStartEditGoal = () => {
    setGoalInput(profile.monthly_goal ? String(profile.monthly_goal) : "");
    setIsEditingGoal(true);
  };

  const handleSaveGoal = async () => {
    if (!user) return;
    const value = parseFloat(goalInput.replace(",", "."));
    if (isNaN(value) || value < 0) {
      toast({
        title: "Valor inválido",
        description: "Informe um valor de meta válido.",
        variant: "destructive",
      });
      return;
    }
    setIsSavingGoal(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ monthly_goal: value })
        .eq("user_id", user.id);

      if (error) throw error;

      setProfile({ ...profile, monthly_goal: value });
      setIsEditingGoal(false);
      toast({
        title: "Meta atualizada!",
        description: `Sua meta mensal de lucro líquido agora é ${value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar a meta.",
        variant: "destructive",
      });
    } finally {
      setIsSavingGoal(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "---";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric"
    });
  };

  const handleUpgrade = () => {
    window.open(getCheckoutUrl(), "_blank");
  };

  if (loading || !user) {
    return null;
  }

  // Esqueleto enquanto o perfil E a checagem de admin carregam — evita "piscar"
  // os dados padrão e o aviso de "Conta Demo" antes de saber que é admin/BLACK
  if (loadingProfile || adminLoading) {
    return (
      <div className="space-y-3 pb-4 md:pb-8 max-w-2xl mx-auto animate-pulse">
        <div className="h-28 rounded-2xl bg-muted" />
        <div className="h-12 rounded-xl bg-muted" />
        <div className="h-12 rounded-xl bg-muted" />
        <div className="h-12 rounded-xl bg-muted" />
        <div className="h-12 rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4 md:pb-8 max-w-2xl mx-auto">
      {/* Header compacto */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate("/profile")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight">Minha Conta</h1>
          <p className="text-xs text-muted-foreground">Dados pessoais e assinatura</p>
        </div>
      </div>

      {/* Faixa BLACK - destaque premium no topo para admin/assinante */}
      {isBlack && (
        <div className="relative overflow-hidden rounded-xl border border-primary/50 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-3 animate-fade-in shadow-[0_0_24px_-8px_hsl(var(--primary)/0.6)]">
          <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.3),transparent_60%)]" />
          <div className="relative flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/25 border border-primary/50 text-lg shrink-0">
              👑
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-primary leading-tight">Usuário BLACK</p>
              <p className="text-xs text-foreground/80 leading-tight mt-0.5">
                Acesso completo liberado · obrigado por fazer parte
              </p>
            </div>
            <Badge className="bg-primary text-primary-foreground border-0 text-xs px-2 py-0 h-5 font-bold tracking-wider shrink-0">
              BLACK
            </Badge>
          </div>
        </div>
      )}

      {/* Faixa Demo - destaque para que o usuário entenda seu status */}
      {!isBlack && isDemo && profile.billing_exempt && (
        <div className="relative overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 via-primary/10 to-transparent p-3 animate-fade-in shadow-[0_0_20px_-8px_hsl(var(--primary)/0.5)]">
          <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.25),transparent_60%)]" />
          <div className="relative flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 text-lg shrink-0">
              🧪
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-primary leading-tight">Conta Demo</p>
              <p className="text-xs text-foreground/80 leading-tight mt-0.5">
                Acesso completo liberado · vire BLACK para remover este aviso
              </p>
            </div>
            <Badge className="bg-primary text-primary-foreground border-0 text-xs px-2 py-0 h-5 font-bold tracking-wider shrink-0">
              DEMO
            </Badge>
          </div>
        </div>
      )}

      {/* User Info Card - compacto e clean */}
      <Card className={`relative overflow-hidden ${
        profile.plan_status === "active"
          ? "border-primary/40 shadow-[0_0_30px_-10px_hsl(var(--primary)/0.6)]"
          : ""
      }`}>
        {profile.plan_status === "active" && (
          <div className="absolute inset-0 pointer-events-none opacity-60 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.18),transparent_55%)]" />
        )}
        <CardContent className="p-4 space-y-3 relative">
          {/* Linha de identidade */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              {avatarPreview || profile.avatar_url ? (
                <img
                  src={avatarPreview || profile.avatar_url}
                  alt="Avatar"
                  className={`w-14 h-14 rounded-full object-cover border ${
                    profile.plan_status === "active"
                      ? "border-primary/60 ring-2 ring-primary/30 shadow-[0_0_18px_-2px_hsl(var(--primary)/0.7)]"
                      : isDemo
                      ? "border-border opacity-80 grayscale-[20%]"
                      : "border-border"
                  }`}
                />
              ) : (
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold ${
                  profile.plan_status === "active"
                    ? "bg-gradient-primary text-primary-foreground shadow-[0_0_18px_-2px_hsl(var(--primary)/0.7)] ring-2 ring-primary/30"
                    : isDemo
                    ? "bg-muted/60 text-muted-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  {profile.nickname ? profile.nickname.charAt(0).toUpperCase() : "U"}
                </div>
              )}
              {isEditing && (
                <label className="absolute -bottom-0.5 -right-0.5 bg-primary rounded-full p-1 cursor-pointer hover:bg-primary/80 transition-colors shadow">
                  <Camera className="h-3 w-3 text-primary-foreground" />
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </label>
              )}
              <AvatarCropper
                open={!!cropSrc}
                imageSrc={cropSrc}
                onCancel={() => setCropSrc(null)}
                onConfirm={handleCropConfirm}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className={`text-base font-semibold leading-tight truncate ${
                  profile.plan_status === "active"
                    ? "text-primary"
                    : isDemo
                    ? "text-foreground/70"
                    : "text-foreground"
                }`}>
                  {profile.nickname || "Usuário"}
                </h2>
                {profile.plan_status === "active" && (
                  <Badge className="bg-primary text-primary-foreground border-0 text-xs px-1.5 py-0 h-5 font-bold tracking-wider shadow-[0_0_12px_-2px_hsl(var(--primary)/0.8)]">
                    <Crown className="w-2.5 h-2.5 mr-0.5" />
                    BLACK
                  </Badge>
                )}
              </div>
              {profile.email && (
                <p className={`text-xs truncate ${isDemo && profile.plan_status !== "active" ? "text-muted-foreground/70" : "text-muted-foreground"}`}>{profile.email}</p>
              )}
            </div>

            {!isEditing && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
                className="h-11 w-11 shrink-0 hover:bg-primary/10"
                aria-label="Editar perfil"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {!isEditing ? (
            <>
              {/* Detalhes em grid compacto */}
              <div className="grid gap-1.5 pt-1 text-xs text-muted-foreground">
                {profile.phone && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📱</span>
                    <span>{profile.phone}</span>
                  </div>
                )}
                {(profile.city || profile.state) && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📍</span>
                    <span>{[profile.city, profile.state].filter(Boolean).join(" - ")}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Membro desde {formatDate(profile.created_at)}</span>
                </div>
              </div>

              {/* Meta mensal de lucro líquido — editável aqui */}
              <div className="pt-2 mt-1 border-t border-border/60">
                {!isEditingGoal ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Meta mensal de lucro líquido</p>
                      <p className={`text-base font-semibold ${
                        profile.plan_status === "active"
                          ? "text-primary"
                          : isDemo
                          ? "text-foreground/70"
                          : "text-foreground"
                      }`}>
                        R$ {profile.monthly_goal.toFixed(2)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartEditGoal}
                      className="shrink-0"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                      Editar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Meta mensal de lucro líquido (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      placeholder="0,00"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleSaveGoal} disabled={isSavingGoal} className="flex-1">
                        <Save className="w-4 h-4 mr-2" />
                        {isSavingGoal ? "Salvando..." : "Salvar meta"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingGoal(false)}
                        disabled={isSavingGoal}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Apelido</Label>
                <Input
                  value={editForm.nickname}
                  onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                  placeholder="Como você quer ser chamado?"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, "") })}
                  placeholder="11999999999"
                  maxLength={11}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2 col-span-1">
                  <Label>Estado</Label>
                  <select
                    value={editForm.state}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value, city: "" })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">UF</option>
                    {BR_STATES.map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Cidade</Label>
                  <select
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    disabled={!editForm.state || loadingEditCities}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
                  >
                    <option value="">
                      {!editForm.state ? "Selecione o estado" : loadingEditCities ? "Carregando..." : "Selecione a cidade"}
                    </option>
                    {editForm.city && !editCities.includes(editForm.city) && (
                      <option value={editForm.city}>{editForm.city}</option>
                    )}
                    {editCities.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>E-mail (opcional)</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="seu@email.com"
                  maxLength={255}
                />
              </div>
              <p className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                💡 A meta mensal de lucro líquido fica logo abaixo, em "Minha Conta" — é só tocar em Editar.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex-1"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Salvando..." : "Salvar"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditForm({
                      nickname: profile.nickname,
                      email: profile.email,
                      avatar_url: profile.avatar_url,
                      phone: profile.phone,
                      state: profile.state,
                      city: profile.city,
                    });
                    setAvatarPreview(profile.avatar_url);
                    setAvatarFile(null);
                  }}
                  disabled={isSaving}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Perfil público - como os outros vendedores te veem */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Perfil público</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Como os outros vendedores te veem no ranking e nas competições
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPublicProfileOpen(true)}
              className="shrink-0"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1.5" />
              Editar perfil público
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de edição do perfil público (ranking/competições) */}
      <RankingProfileModal
        open={publicProfileOpen}
        onOpenChange={setPublicProfileOpen}
        userId={user.id}
        currentNickname={profile.nickname}
        currentAvatar={profile.avatar_url}
        onProfileUpdated={() => { loadProfile(); }}
      />

      {/* Admin: tudo unificado no Perfil → Administração (/admin). Sem botões
          soltos aqui — o painel central concentra assinaturas, IA, testes etc. */}

      {/* Subscription Card - Apenas para não assinantes */}
      {profile.plan_status !== 'active' && !profile.billing_exempt && (
        <Card className="overflow-hidden relative border-primary/30">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
          <CardContent className="p-4 space-y-4 relative z-10">
            {/* Cabeçalho compacto */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold leading-tight">Orbis BLACK</p>
                  <p className="text-xs text-muted-foreground">Plano Mensal Premium</p>
                </div>
              </div>
              <Badge className="bg-success/15 text-success border border-success/30 text-xs px-1.5 py-0 h-5 font-semibold shrink-0">
                3 dias grátis
              </Badge>
            </div>

            {/* Preço */}
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">R$ 29,99</span>
              <span className="text-xs text-muted-foreground">/mês</span>
            </div>

            {/* Recursos compactos */}
            <div className="grid gap-1.5">
              {subscriptionFeatures.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-xs text-foreground/85">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={handleUpgrade}
              disabled={isUpgrading}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              <Crown className="w-4 h-4 mr-2" />
              {isUpgrading ? "Processando..." : "Assinar Agora"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              🔒 Cancele quando quiser. Sem taxas escondidas.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status PRO - Para assinantes ativos */}
      {profile.plan_status === 'active' && !isDemo && (
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold leading-tight">Usuário BLACK</p>
                  <p className="text-xs text-muted-foreground truncate">Acesso completo aos recursos premium</p>
                </div>
              </div>
              <Badge className="bg-primary/15 text-primary border border-primary/30 text-xs px-1.5 py-0 h-5 font-semibold shrink-0">
                PRO
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Card - compacto */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Suas Estatísticas</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/30 py-2.5">
              <p className="text-lg font-bold text-foreground">{stats.transactions}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Vendas</p>
            </div>
            <div className="rounded-lg bg-muted/30 py-2.5">
              <p className="text-lg font-bold text-foreground">{stats.goals}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Rotinas</p>
            </div>
            <div className="rounded-lg bg-muted/30 py-2.5">
              <p className="text-lg font-bold text-foreground">{stats.insights}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Atividades</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
