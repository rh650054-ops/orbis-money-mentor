import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Mail, Calendar, TrendingUp, CheckCircle2, Edit2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState({
    nickname: "",
    email: "",
    created_at: ""
  });
  const [editForm, setEditForm] = useState({
    nickname: "",
    email: ""
  });
  const [stats, setStats] = useState({
    transactions: 0,
    goals: 0,
    insights: 0
  });
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
        created_at: data.created_at || ""
      });
      setEditForm({
        nickname: data.nickname || "",
        email: data.email || ""
      });
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
          created_at: newProfile.created_at || ""
        });
        setEditForm({
          nickname: newProfile.nickname || "",
          email: newProfile.email || ""
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

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          nickname: editForm.nickname,
          email: editForm.email
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setProfile({
        ...profile,
        nickname: editForm.nickname,
        email: editForm.email
      });

      setIsEditing(false);
      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram salvas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o perfil.",
        variant: "destructive"
      });
    } finally {
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

  if (loading || !user) {
    return null;
  }

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Perfil</h1>
        <p className="text-muted-foreground mt-1">Gerencie sua conta e assinatura</p>
      </div>

      {/* User Info Card */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-2xl font-bold shadow-glow-primary">
                {profile.nickname ? profile.nickname.charAt(0).toUpperCase() : "U"}
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
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Apelido</Label>
                <Input
                  value={editForm.nickname}
                  onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                  placeholder="Como você quer ser chamado?"
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="seu@email.com"
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
                      email: profile.email
                    });
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

          <Button className="w-full bg-gradient-primary hover:opacity-90 transition-smooth shadow-glow-primary">
            Iniciar Período Gratuito
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
