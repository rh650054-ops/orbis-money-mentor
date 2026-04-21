import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Mail, Calendar, TrendingUp, CheckCircle2, Edit2, Save, X, Camera, Upload, Shield, UserPlus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { MonthlyChallengeCard } from "@/components/MonthlyChallengeCard";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useBrazilCities } from "@/hooks/useBrazilCities";

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
  const { whitelisted: isAdmin } = useAdminAccess(user?.id);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
  const [stats, setStats] = useState({
    transactions: 0,
    goals: 0,
    insights: 0
  });
  const [isUpgrading] = useState(false);
  const subscriptionFeatures = [
    "Insights ilimitados da IA",
    "Análises avançadas de gastos",
    "Relatórios personalizados",
    "Metas ilimitadas",
    "Suporte prioritário",
    "Exportação de dados",
  ];

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
      .single();

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
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Erro",
          description: "Arquivo muito grande. Máximo 2MB.",
          variant: "destructive"
        });
        return;
      }
      
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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
          description: firstError.message,
          variant: "destructive"
        });
        setIsSaving(false);
        return;
      }

      let finalAvatarUrl = editForm.avatar_url;

      // Upload avatar se houver
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        
        // Converter para base64 e salvar no perfil
        const reader = new FileReader();
        reader.onloadend = async () => {
          finalAvatarUrl = reader.result as string;
          
          const { error: updateError } = await supabase
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

          if (updateError) throw updateError;

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
        };
        reader.readAsDataURL(avatarFile);
      } else {
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
        toast({
          title: "Perfil atualizado!",
          description: "Suas informações foram salvas com sucesso.",
        });
        setIsSaving(false);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o perfil.",
        variant: "destructive"
      });
      setIsSaving(false);
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
    window.open("https://pay.hotmart.com/N104683123F", "_blank");
  };

  if (loading || !user) {
    return null;
  }

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold gradient-text">Minha Conta</h1>
          <p className="text-sm text-muted-foreground">Gerencie sua conta e assinatura</p>
        </div>
      </div>

      {/* Faixa Demo */}
      {profile.is_demo && profile.billing_exempt && (
        <Card className="glass border-2 border-primary/30 bg-gradient-to-r from-primary/10 to-secondary/10 animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg">🧪 Conta Demo Orbis</p>
                <p className="text-sm text-muted-foreground">
                  Acesso completo liberado • Sem limitações
                </p>
              </div>
              <Badge className="bg-gradient-to-r from-primary to-secondary text-primary-foreground px-3 py-1 text-sm shadow-lg">
                DEMO
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Info Card */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                {avatarPreview || profile.avatar_url ? (
                  <img 
                    src={avatarPreview || profile.avatar_url} 
                    alt="Avatar" 
                    className={`w-16 h-16 rounded-full object-cover border-2 ${
                      profile.plan_status === "active" 
                        ? "shadow-glow-primary border-purple-500/50 ring-2 ring-purple-500/30" 
                        : "shadow-glow-primary border-primary/20"
                    }`}
                  />
                ) : (
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                    profile.plan_status === "active" 
                      ? "bg-gradient-to-br from-purple-600 via-primary to-blue-600 shadow-glow-primary ring-2 ring-purple-500/30" 
                      : "bg-gradient-primary shadow-glow-primary"
                  }`}>
                    {profile.nickname ? profile.nickname.charAt(0).toUpperCase() : "U"}
                  </div>
                )}
                {isEditing && (
                  <label className="absolute bottom-0 right-0 bg-primary rounded-full p-1.5 cursor-pointer hover:bg-primary/80 transition-colors shadow-lg">
                    <Camera className="h-3 w-3 text-primary-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>{profile.nickname || "Usuário"}</CardTitle>
                  {profile.plan_status === "active" && (
                    <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-none shadow-glow-primary">
                      <Crown className="w-3 h-3 mr-1 text-yellow-400" />
                      BLACK
                    </Badge>
                  )}
                </div>
                <CardDescription>{profile.email}</CardDescription>
              </div>
            </div>
            {!isEditing && (
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setIsEditing(true)}
                className="hover:bg-primary/10"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEditing ? (
            <>
              {profile.email && (
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span>{profile.email}</span>
                </div>
              )}
              {profile.phone && (
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <span className="text-base">📱</span>
                  <span>{profile.phone}</span>
                </div>
              )}
              {(profile.city || profile.state) && (
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <span className="text-base">📍</span>
                  <span>{[profile.city, profile.state].filter(Boolean).join(" - ")}</span>
                </div>
              )}
              <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Membro desde {formatDate(profile.created_at)}</span>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Meta Mensal</Label>
                <p className="text-2xl font-bold gradient-text">
                  R$ {profile.monthly_goal.toFixed(2)}
                </p>
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
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
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
                  <Input
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    placeholder="Sua cidade"
                    maxLength={80}
                  />
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
                💡 Para editar a meta mensal, use o painel "Editar Planejamento" no Dashboard.
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

      {/* Admin Panel Access Card - apenas para admins */}
      {isAdmin && (
      <Card className="glass border-primary/30 bg-gradient-to-r from-primary/5 to-secondary/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Painel Administrativo</CardTitle>
              <CardDescription>Gerenciar contas demo para influenciadores</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            onClick={() => navigate("/admin/demo-users")}
            className="w-full"
            variant="outline"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Acessar Painel de Contas Demo
          </Button>
          <Button 
            onClick={() => navigate("/admin/subscriptions")}
            className="w-full"
            variant="outline"
          >
            <Shield className="w-4 h-4 mr-2" />
            Gerenciar Assinaturas
          </Button>
        </CardContent>
      </Card>
      )}

      {/* Subscription Card - Apenas para não assinantes */}
      {profile.plan_status !== 'active' && !profile.billing_exempt && (
        <Card className="glass overflow-hidden relative bg-gradient-to-br from-purple-950/30 via-primary/20 to-blue-950/30 border-purple-500/30 shadow-glow-primary">
          <div className="absolute top-0 right-0 w-60 h-60 bg-gradient-to-br from-purple-500/20 to-blue-500/20 blur-3xl rounded-full"></div>
          <CardHeader>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center space-x-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-glow-primary">
                  <Crown className="w-7 h-7 text-yellow-400" />
                </div>
                <div>
                  <CardTitle className="text-xl gradient-text">Orbis BLACK</CardTitle>
                  <CardDescription className="text-muted-foreground/90">Plano Mensal Premium</CardDescription>
                </div>
              </div>
              <Badge className="bg-gradient-to-r from-green-600 to-green-500 text-white border-none font-bold px-3 py-1 shadow-lg">
                3 Dias Grátis
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 relative z-10">
            <div className="space-y-4">
              <p className="text-muted-foreground/90">
                Aproveite todos os recursos premium do Orbis por apenas:
              </p>
              <div className="flex items-baseline space-x-2">
                <span className="text-5xl font-bold gradient-text">R$ 19,90</span>
                <span className="text-muted-foreground text-lg">/mês</span>
              </div>
            </div>

            <Separator className="bg-purple-500/20" />

            <div className="space-y-3">
              <p className="font-semibold text-lg gradient-text">Recursos incluídos:</p>
              <div className="grid gap-3">
                {subscriptionFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-3 bg-background/30 p-2 rounded-lg backdrop-blur-sm">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span className="text-sm text-foreground/90">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleUpgrade}
              disabled={isUpgrading}
              className="w-full h-14 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-lg font-bold border-none shadow-glow-primary transition-all"
            >
              <Crown className="w-5 h-5 mr-2 text-yellow-400" />
              {isUpgrading ? "Processando..." : "Assinar Agora"}
            </Button>

            <p className="text-xs text-center text-muted-foreground/80">
              🔒 Cancele quando quiser. Sem taxas escondidas.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status PRO - Para assinantes ativos */}
      {profile.plan_status === 'active' && !profile.is_demo && (
        <Card className="glass border-2 bg-gradient-to-br from-purple-950/40 via-primary/30 to-blue-950/40 border-purple-500/50 shadow-glow-primary">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-glow-primary">
                  <Crown className="w-9 h-9 text-yellow-400 drop-shadow-glow" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold gradient-text">Usuário BLACK</h3>
                  <p className="text-sm text-muted-foreground/90">✨ Acesso completo a todos os recursos premium</p>
                </div>
              </div>
              <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-none px-5 py-2 text-base font-bold shadow-glow-primary">
                PRO
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Challenge Card */}
      {user && <MonthlyChallengeCard userId={user.id} />}

      {/* Stats Card */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Suas Estatísticas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{stats.transactions}</p>
              <p className="text-xs text-muted-foreground">Vendas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary">{stats.goals}</p>
              <p className="text-xs text-muted-foreground">Rotinas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-success">{stats.insights}</p>
              <p className="text-xs text-muted-foreground">Atividades</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
