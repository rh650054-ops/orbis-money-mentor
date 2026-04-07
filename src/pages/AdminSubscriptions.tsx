import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield, Search, UserCheck, UserX, RefreshCw, Link2 } from "lucide-react";

interface SubscriptionUser {
  id: string;
  user_id: string;
  email: string;
  nickname: string;
  plan_status: string;
  is_demo: boolean;
  billing_exempt: boolean;
  trial_end: string | null;
}

export default function AdminSubscriptions() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<SubscriptionUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkCpf, setLinkCpf] = useState("");
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (user) checkAdminRole();
  }, [user, loading, navigate]);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  const checkAdminRole = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();
      setIsAdmin(!!data);
    } catch {
      setIsAdmin(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, email, nickname, plan_status, is_demo, billing_exempt, trial_end")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleToggleSubscription = async (targetUserId: string, currentStatus: string) => {
    setIsUpdating(targetUserId);
    const newStatus = currentStatus === "active" ? "expired" : "active";

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          plan_status: newStatus,
          plan_type: newStatus === "active" ? "pro" : "expired",
          is_trial_active: false,
        })
        .eq("user_id", targetUserId);

      if (error) throw error;

      toast({
        title: newStatus === "active" ? "✅ Assinatura ativada!" : "❌ Assinatura desativada",
        description: `Status alterado para: ${newStatus}`,
      });

      loadUsers();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchEmail) return true;
    const search = searchEmail.toLowerCase();
    return (
      u.email?.toLowerCase().includes(search) ||
      u.nickname?.toLowerCase().includes(search)
    );
  });

  if (loading || isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md glass border-destructive/30">
          <CardHeader>
            <CardTitle className="flex flex-col items-center gap-3 text-center">
              <Shield className="w-12 h-12 text-destructive" />
              <span className="text-destructive">Acesso Negado</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Apenas administradores podem acessar esta área.
            </p>
            <Button variant="outline" onClick={() => navigate("/profile")} className="w-full">
              Voltar ao Perfil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold gradient-text">Gerenciar Assinaturas</h1>
          <p className="text-muted-foreground mt-1">
            Ative ou desative assinaturas manualmente (provider: Hotmart)
          </p>
        </div>
      </div>

      {/* Search */}
      <Card className="glass">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <Label>Buscar por email ou apelido</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="email@exemplo.com"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={loadUsers}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Link CPF */}
      <Card className="glass border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Vincular CPF a Conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use quando um usuário se cadastrou com e-mail mas precisa vincular o CPF para login.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>E-mail da conta</Label>
              <Input
                placeholder="email@exemplo.com"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>CPF (11 dígitos)</Label>
              <Input
                placeholder="12345678900"
                value={linkCpf}
                onChange={(e) => setLinkCpf(e.target.value.replace(/\D/g, ""))}
                maxLength={11}
                inputMode="numeric"
              />
            </div>
          </div>
          <Button
            onClick={async () => {
              if (!linkEmail || linkCpf.length !== 11) {
                toast({ title: "Preencha e-mail e CPF (11 dígitos)", variant: "destructive" });
                return;
              }
              setIsLinking(true);
              try {
                const { data, error } = await supabase.functions.invoke("link-cpf-to-account", {
                  body: { email: linkEmail.trim(), cpf: linkCpf },
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.error);
                toast({
                  title: "✅ CPF vinculado com sucesso!",
                  description: data?.message || "Usuário pode fazer login com CPF agora.",
                });
                setLinkEmail("");
                setLinkCpf("");
                loadUsers();
              } catch (err: any) {
                toast({
                  title: "Erro ao vincular CPF",
                  description: err.message || "Tente novamente.",
                  variant: "destructive",
                });
              } finally {
                setIsLinking(false);
              }
            }}
            disabled={isLinking}
            className="w-full"
          >
            {isLinking ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Link2 className="w-4 h-4 mr-2" />
            )}
            Vincular CPF
          </Button>
        </CardContent>
      </Card>

      {/* Users list */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Usuários ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum usuário encontrado.</p>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-4 bg-card rounded-lg border border-border hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold truncate">{u.nickname || "Sem nome"}</p>
                        {u.is_demo && u.billing_exempt && (
                          <Badge variant="secondary" className="text-xs">DEMO</Badge>
                        )}
                        <Badge
                          className={
                            u.plan_status === "active"
                              ? "bg-green-600 text-white text-xs"
                              : u.plan_status === "trial"
                              ? "bg-yellow-600 text-white text-xs"
                              : "bg-red-600 text-white text-xs"
                          }
                        >
                          {u.plan_status || "trial"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                      {u.trial_end && (
                        <p className="text-xs text-muted-foreground">
                          Trial até: {new Date(u.trial_end).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={u.plan_status === "active" ? "destructive" : "default"}
                      onClick={() => handleToggleSubscription(u.user_id, u.plan_status || "trial")}
                      disabled={isUpdating === u.user_id || (u.is_demo && u.billing_exempt)}
                    >
                      {isUpdating === u.user_id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : u.plan_status === "active" ? (
                        <>
                          <UserX className="w-4 h-4 mr-1" />
                          Desativar
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4 mr-1" />
                          Ativar
                        </>
                      )}
                    </Button>
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
