import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  UserPlus,
  Users,
  Copy,
  Check,
  Trash2,
  Shield,
  Eye,
  EyeOff
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DemoUser {
  id: string;
  user_id: string;
  email: string;
  nickname: string;
  demo_note: string;
  created_at: string;
}

export default function AdminDemoUsers() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    nickname: "",
    note: ""
  });

  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      loadDemoUsers();
    }
  }, [user, loading, navigate]);

  const loadDemoUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, email, nickname, demo_note, created_at")
        .eq("is_demo", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDemoUsers(data || []);
    } catch (error) {
      console.error("Erro ao carregar usuários demo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os usuários demo.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleCreateDemoUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email) {
      toast({
        title: "Erro",
        description: "Email é obrigatório",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);

    try {
      console.log('Chamando função create-demo-user...');
      
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase.functions.invoke('create-demo-user', {
        body: {
          email: formData.email,
          nickname: formData.nickname || formData.email.split('@')[0],
          note: formData.note || 'Conta de demonstração criada manualmente'
        },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      console.log('Resposta da função:', { data, error });

      if (error) {
        console.error('Erro da edge function:', error);
        throw error;
      }

      if (data?.success) {
        setCreatedCredentials({
          email: data.user.email,
          password: data.user.password
        });

        toast({
          title: "✅ Conta demo criada!",
          description: "As credenciais foram geradas com sucesso."
        });

        setFormData({ email: "", nickname: "", note: "" });
        loadDemoUsers();
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error("Erro ao criar conta demo:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar a conta demo.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: "✅ Copiado!",
        description: `${field} copiado para a área de transferência.`
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar.",
        variant: "destructive"
      });
    }
  };

  const handleRevokeDemoUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_demo: false,
          billing_exempt: false,
          plan_status: 'expired',
          demo_note: 'Conta demo revogada'
        })
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "✅ Conta revogada",
        description: "A conta demo foi desativada com sucesso."
      });

      loadDemoUsers();
    } catch (error) {
      console.error("Erro ao revogar conta:", error);
      toast({
        title: "Erro",
        description: "Não foi possível revogar a conta demo.",
        variant: "destructive"
      });
    }
  };

  if (loading || isLoadingUsers) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold gradient-text">Gerenciar Contas Demo</h1>
          <p className="text-muted-foreground mt-1">
            Crie e gerencie contas de demonstração ilimitadas
          </p>
        </div>
      </div>

      {/* Formulário de Criação */}
      <Card className="glass card-gradient-border shadow-glow-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Criar Nova Conta Demo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateDemoUser} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="influenciador@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nickname">Apelido</Label>
                <Input
                  id="nickname"
                  placeholder="Opcional"
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Observação</Label>
              <Textarea
                id="note"
                placeholder="Ex: Conta para influenciador X"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={3}
              />
            </div>
            <Button type="submit" disabled={isCreating} className="w-full">
              {isCreating ? "Criando..." : "Criar Conta Demo"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Credenciais Criadas */}
      {createdCredentials && (
        <Card className="glass border-success/30 bg-success/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-success">
              <Check className="w-5 h-5" />
              Conta Demo Criada com Sucesso!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-card rounded-lg border border-success/20">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-mono font-semibold">{createdCredentials.email}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(createdCredentials.email, "Email")}
                  >
                    {copiedField === "Email" ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Senha</p>
                    <p className="font-mono font-semibold">
                      {showPassword ? createdCredentials.password : "••••••••••••"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(createdCredentials.password, "Senha")}
                    >
                      {copiedField === "Senha" ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setCreatedCredentials(null)}
            >
              Fechar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Lista de Usuários Demo */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Contas Demo Ativas ({demoUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {demoUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma conta demo criada ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {demoUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-4 bg-card rounded-lg border border-primary/20 hover:border-primary/40 transition-smooth"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-semibold">{user.nickname || user.email}</p>
                        <Badge className="bg-gradient-to-r from-primary to-secondary text-xs">
                          DEMO
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      {user.demo_note && (
                        <p className="text-sm text-muted-foreground mt-1 italic">
                          {user.demo_note}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Criado em: {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revogar Acesso Demo</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja revogar o acesso demo desta conta?
                            A conta será desativada e o usuário não poderá mais acessar o sistema.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRevokeDemoUser(user.user_id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Revogar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}