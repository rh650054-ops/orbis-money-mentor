import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Mail, Calendar, TrendingUp, CheckCircle2, Edit2, Save, X, Camera, Upload, Shield, UserPlus } from "lucide-react";
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

const profileSchema = z.object({
  nickname: z.string()
    .trim()
    .min(1, { message: "Apelido não pode estar vazio" })
    .max(100, { message: "Apelido deve ter no máximo 100 caracteres" }),
  email: z.string()
    .trim()
    .email({ message: "E-mail inválido" })
    .max(255, { message: "E-mail deve ter no máximo 255 caracteres" }),
  monthly_goal: z.number()
    .min(0, { message: "Meta deve ser positiva" })
});

export default function Profile() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState({
    nickname: "",
    email: "",
    created_at: "",
    monthly_goal: 0,
    avatar_url: "",
    is_demo: false,
    billing_exempt: false
  });
  const [editForm, setEditForm] = useState({
    nickname: "",
    email: "",
    monthly_goal: 0,
    avatar_url: ""
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [stats, setStats] = useState({
    transactions: 0,
    goals: 0,
    insights: 0
  });
  const [isUpgrading, setIsUpgrading] = useState(false);
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
        billing_exempt: data.billing_exempt || false
      });
      setEditForm({
        nickname: data.nickname || "",
        email: data.email || "",
        monthly_goal: data.monthly_goal || 0,
        avatar_url: data.avatar_url || ""
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
          billing_exempt: newProfile.billing_exempt || false
        });
        setEditForm({
          nickname: newProfile.nickname || "",
          email: newProfile.email || "",
          monthly_goal: newProfile.monthly_goal || 0,
          avatar_url: newProfile.avatar_url || ""
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
              email: editForm.email.trim(),
              monthly_goal: editForm.monthly_goal,
              avatar_url: finalAvatarUrl
            })
            .eq("user_id", user.id);

          if (updateError) throw updateError;

          setProfile({
            ...profile,
            nickname: editForm.nickname,
            email: editForm.email,
            monthly_goal: editForm.monthly_goal,
            avatar_url: finalAvatarUrl
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
            email: editForm.email.trim(),
            monthly_goal: editForm.monthly_goal,
            avatar_url: finalAvatarUrl
          })
          .eq("user_id", user.id);

        if (error) throw error;

        setProfile({
          ...profile,
          nickname: editForm.nickname,
          email: editForm.email,
          monthly_goal: editForm.monthly_goal,
          avatar_url: finalAvatarUrl
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

  const handleUpgrade = async () => {
    if (!user) return;
    setIsUpgrading(true);

    try {
      toast({
        title: "Redirecionando para pagamento...",
        description: "Aguarde enquanto preparamos seu checkout.",
      });

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
        toast({
          title: "Checkout aberto!",
          description: "Complete o pagamento na nova aba.",
        });
      }
    } catch (error) {
      console.error("Erro ao criar checkout:", error);
      toast({
        title: "Erro ao processar",
        description: "Não foi possível iniciar o checkout. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  if (loading || !user) {
    return null;
  }

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Perfil</h1>
        <p className="text-muted-foreground mt-1">Gerencie sua conta e assinatura</p>
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
                    className="w-16 h-16 rounded-full object-cover shadow-glow-primary border-2 border-primary/20"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-2xl font-bold shadow-glow-primary">
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
                <CardTitle>{profile.nickname || "Usuário"}</CardTitle>
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
              <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span>{profile.email}</span>
              </div>
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
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="seu@email.com"
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label>Meta Mensal (R$)</Label>
                <Input
                  type="number"
                  value={editForm.monthly_goal}
                  onChange={(e) => setEditForm({ ...editForm, monthly_goal: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
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
                      monthly_goal: profile.monthly_goal,
                      avatar_url: profile.avatar_url
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

      {/* Admin Panel Access Card - Visível apenas para admins/primeiros usuários */}
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
        <CardContent>
          <Button 
            onClick={() => navigate("/admin/demo-users")}
            className="w-full"
            variant="outline"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Acessar Painel de Contas Demo
          </Button>
        </CardContent>
      </Card>

      {/* Subscription Card */}
      <Card className="glass card-gradient-border overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-primary opacity-20 blur-3xl rounded-full"></div>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow-primary">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <CardTitle>Orbis Premium</CardTitle>
                <CardDescription>Plano Mensal</CardDescription>
              </div>
            </div>
            <Badge className="bg-success/20 text-success">7 Dias Grátis</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Aproveite todos os recursos premium do Orbis por apenas:
            </p>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-bold gradient-text">R$ 19,90</span>
              <span className="text-muted-foreground">/mês</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="font-semibold">Recursos incluídos:</p>
            <div className="grid gap-2">
              {subscriptionFeatures.map((feature, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <Button 
            onClick={handleUpgrade}
            disabled={isUpgrading}
            className="w-full bg-gradient-primary hover:opacity-90 transition-smooth shadow-glow-primary"
          >
            <Crown className="w-4 h-4 mr-2" />
            {isUpgrading ? "Processando..." : "Assinar por R$ 19,90/mês"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Cancele quando quiser. Sem taxas escondidas.
          </p>
        </CardContent>
      </Card>

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
