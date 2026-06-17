import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield, Search, UserCheck, UserX, RefreshCw, Link2, Trash2, Pencil, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { syncLeaderboardRevenue } from "@/utils/syncDailySales";

interface SubscriptionUser {
  id: string;
  user_id: string;
  email: string | null;
  nickname: string | null;
  plan_status: string | null;
  is_demo: boolean | null;
  billing_exempt: boolean | null;
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
  const [statusFilter, setStatusFilter] = useState<"assinantes" | "trial" | "todos">("assinantes");
  // Edição de perfil de um usuário (admin)
  const [editUser, setEditUser] = useState<SubscriptionUser | null>(null);
  const [editForm, setEditForm] = useState({ nickname: "", phone: "", cpf: "", city: "", state: "", email: "" });
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [rankingHidden, setRankingHidden] = useState(false);
  const [savingRanking, setSavingRanking] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkCpf, setLinkCpf] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

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
      // Fonte de verdade do app: admin_access (por CPF) via edge function
      const { data: adminData } = await supabase.functions.invoke("check-admin-access");
      if (adminData?.whitelisted && adminData?.role === "admin") {
        setIsAdmin(true);
        return;
      }
      // Fallback: tabela user_roles
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

  // Abre o modal e carrega o perfil completo do usuário (telefone, CPF, cidade/estado)
  const openEditUser = async (u: SubscriptionUser) => {
    setEditUser(u);
    setLoadingEdit(true);
    setEditForm({ nickname: u.nickname || "", phone: "", cpf: "", city: "", state: "", email: u.email || "" });
    const { data } = await supabase
      .from("profiles")
      .select("nickname, phone, cpf, city, state, email, ranking_hidden")
      .eq("user_id", u.user_id)
      .maybeSingle();
    if (data) {
      const d = data as any;
      setEditForm({
        nickname: d.nickname || "",
        phone: d.phone || "",
        cpf: d.cpf || "",
        city: d.city || "",
        state: d.state || "",
        email: d.email || "",
      });
      setRankingHidden(Boolean(d.ranking_hidden));
    }
    setLoadingEdit(false);
  };

  // Remove (oculta) ou devolve o usuário ao ranking. Persiste via profiles.ranking_hidden,
  // limpa/recria a entrada em leaderboard_stats e recalcula as posições do mês.
  const toggleRankingHidden = async () => {
    if (!editUser) return;
    setSavingRanking(true);
    try {
      const newHidden = !rankingHidden;
      const { error } = await supabase
        .from("profiles")
        .update({ ranking_hidden: newHidden } as any)
        .eq("user_id", editUser.user_id);
      if (error) throw error;

      if (newHidden) {
        // Tira do ranking agora (todas as entradas)
        await supabase.from("leaderboard_stats").delete().eq("user_id", editUser.user_id);
      } else {
        // Volta ao ranking: reconstrói a entrada a partir das vendas do mês
        await syncLeaderboardRevenue(editUser.user_id);
      }

      const now = new Date();
      const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      await supabase.rpc("recalculate_ranking_positions", { target_month: mes });

      setRankingHidden(newHidden);
      toast({ title: newHidden ? "🚫 Removido do ranking" : "✅ De volta ao ranking" });
    } catch (err: any) {
      toast({ title: "Erro no ranking", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSavingRanking(false);
    }
  };

  // Salva as alterações direto no profiles (admin tem permissão, mesmo caminho do toggle de assinatura)
  const saveEditUser = async () => {
    if (!editUser) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          nickname: editForm.nickname || null,
          phone: editForm.phone || null,
          cpf: editForm.cpf ? editForm.cpf.replace(/\D/g, "") : null,
          city: editForm.city || null,
          state: editForm.state || null,
        } as any)
        .eq("user_id", editUser.user_id);
      if (error) throw error;
      toast({ title: "✅ Perfil atualizado", description: editForm.nickname || editUser.email || "" });
      setEditUser(null);
      loadUsers();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSavingEdit(false);
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

  const handleDeleteUser = async (targetUserId: string, label: string) => {
    const typed = window.prompt(
      `EXCLUIR DEFINITIVAMENTE a conta de "${label}"?\n\nIsso remove a conta do sistema e LIBERA o CPF e o e-mail (pra usar de novo, a pessoa cria do zero). NAO da pra desfazer.\n\nDigite EXCLUIR para confirmar:`
    );
    if (typed !== "EXCLUIR") return;
    setIsDeleting(targetUserId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { userId: targetUserId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: "\uD83D\uDDD1\uFE0F Conta excluida",
        description: (data as any)?.message || "CPF e e-mail liberados para um novo cadastro.",
      });
      setUsers((prev) => prev.filter((x) => x.user_id !== targetUserId));
    } catch (err: any) {
      toast({
        title: "Erro ao excluir conta",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const isComp = (u: SubscriptionUser) => Boolean(u.is_demo && u.billing_exempt); // contas de cortesia/admin
  const filteredUsers = users.filter((u) => {
    // Filtro por aba/status
    if (statusFilter === "assinantes" && !(u.plan_status === "active" && !isComp(u))) return false;
    if (statusFilter === "trial" && u.plan_status !== "trial") return false;
    // Busca por texto
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
        <Card className="w-full max-w-md border-destructive/30">
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
    <div className="space-y-6 pb-4 md:pb-8">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Gerenciar Assinaturas</h1>
          <p className="text-muted-foreground mt-1">
            Ative ou desative assinaturas manualmente (provider: Hotmart)
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
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
          {/* Filtro por aba: Assinantes / Trial / Todos */}
          <div className="flex gap-2 mt-4">
            {([["assinantes", "Assinantes"], ["trial", "Trial (3 dias)"], ["todos", "Todos"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Link CPF */}
      <Card className="border-primary/30">
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
      <Card>
        <CardHeader>
          <CardTitle>
            {statusFilter === "assinantes" ? "Assinantes" : statusFilter === "trial" ? "Em teste (3 dias)" : "Todos os usuários"} ({filteredUsers.length})
          </CardTitle>
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
                              ? "bg-success text-success-foreground text-xs"
                              : u.plan_status === "trial"
                              ? "bg-warning text-warning-foreground text-xs"
                              : "bg-destructive text-destructive-foreground text-xs"
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
                    <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditUser(u)}
                      title="Ver/editar perfil"
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant={u.plan_status === "active" ? "destructive" : "default"}
                      onClick={() => handleToggleSubscription(u.user_id, u.plan_status || "trial")}
                      disabled={isUpdating === u.user_id || Boolean(u.is_demo && u.billing_exempt)}
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
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleDeleteUser(u.user_id, u.email || u.nickname || u.user_id)}
                      disabled={isDeleting === u.user_id}
                      title="Excluir conta definitivamente"
                    >
                      {isDeleting === u.user_id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: editar perfil do usuário */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
          </DialogHeader>
          {loadingEdit ? (
            <p className="text-center text-muted-foreground py-6">Carregando...</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome / apelido</Label>
                <Input value={editForm.nickname} onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="(11) 90000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input
                  value={editForm.cpf}
                  onChange={(e) => setEditForm({ ...editForm, cpf: e.target.value.replace(/\D/g, "") })}
                  maxLength={11}
                  inputMode="numeric"
                  placeholder="11 dígitos"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Cidade</Label>
                  <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado (UF)</Label>
                  <Input
                    value={editForm.state}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value.toUpperCase().slice(0, 2) })}
                    maxLength={2}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>E-mail (somente leitura)</Label>
                <Input value={editForm.email} disabled />
                <p className="text-xs text-muted-foreground">
                  Mudar o e-mail de login precisa de um passo extra — me avise se precisar.
                </p>
              </div>

              {/* Moderação do ranking */}
              <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Ranking</p>
                  <p className="text-xs text-muted-foreground">
                    {rankingHidden ? "Oculto do ranking" : "Aparece no ranking"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={rankingHidden ? "outline" : "destructive"}
                  onClick={toggleRankingHidden}
                  disabled={savingRanking}
                >
                  {savingRanking ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : rankingHidden ? (
                    "Voltar ao ranking"
                  ) : (
                    "Remover do ranking"
                  )}
                </Button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditUser(null)} disabled={savingEdit}>
                  Cancelar
                </Button>
                <Button onClick={saveEditUser} disabled={savingEdit}>
                  {savingEdit ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
