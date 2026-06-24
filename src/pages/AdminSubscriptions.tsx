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
import { Shield, Search, UserCheck, UserX, RefreshCw, Link2, Trash2, Pencil, Save, KeyRound, Copy, Check, MessageCircle, Crown } from "lucide-react";
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
  comp_label: string | null;
  trial_end: string | null;
  phone: string | null;
  cpf: string | null;
}

export default function AdminSubscriptions() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<SubscriptionUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [statusFilter, setStatusFilter] = useState<"assinantes" | "trial" | "ultimo_dia" | "expirados" | "cortesias" | "todos">("assinantes");
  // Edição de perfil de um usuário (admin)
  const [editUser, setEditUser] = useState<SubscriptionUser | null>(null);
  const [editForm, setEditForm] = useState({ nickname: "", phone: "", cpf: "", city: "", state: "", email: "" });
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editComp, setEditComp] = useState<{ exempt: boolean; label: string | null }>({ exempt: false, label: null });
  const [savingComp, setSavingComp] = useState(false);
  const [rankingHidden, setRankingHidden] = useState(false);
  const [savingRanking, setSavingRanking] = useState(false);
  // Correção de resultados/vendas do usuário (anti-trapaça)
  const [userSales, setUserSales] = useState<any[]>([]);
  const [saleEdits, setSaleEdits] = useState<Record<string, string>>({});
  const [savingSaleId, setSavingSaleId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkCpf, setLinkCpf] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  // Super admin: pode promover/rebaixar admins pelo painel
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminMap, setAdminMap] = useState<Record<string, boolean>>({}); // cpf(digitos) -> is_super_admin
  const [grantingCpf, setGrantingCpf] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (user) checkAdminRole();
  }, [user, loading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
      loadAdminMeta();
    }
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
        .select("id, user_id, email, nickname, plan_status, is_demo, billing_exempt, comp_label, trial_end, phone, cpf")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Descobre se o usuário atual é SUPER admin e carrega quem já é admin (por CPF).
  // Só o super admin enxerga/edita a lista de admins (RLS).
  const loadAdminMeta = async () => {
    try {
      const { data: superData } = await (supabase as any).rpc("is_orbis_super_admin");
      setIsSuperAdmin(!!superData);
      if (superData) {
        const { data: rows } = await (supabase as any)
          .from("admin_access")
          .select("cpf, enabled, is_super_admin");
        const map: Record<string, boolean> = {};
        ((rows as any[]) || []).forEach((r) => {
          if (r.enabled) map[String(r.cpf).replace(/\D/g, "")] = !!r.is_super_admin;
        });
        setAdminMap(map);
      }
    } catch {
      setIsSuperAdmin(false);
    }
  };

  // Promove/rebaixa um usuário a admin (só super admin). Insere/remove o CPF
  // na admin_access. O banco impede mexer num super admin.
  const toggleAdmin = async (u: SubscriptionUser) => {
    const cpf = (u.cpf || "").replace(/\D/g, "");
    if (cpf.length !== 11) {
      toast({ title: "Sem CPF válido", description: "Esse usuário não tem CPF completo no perfil.", variant: "destructive" });
      return;
    }
    if (adminMap[cpf]) {
      toast({ title: "Super admin", description: "Um super admin não pode ser removido pelo painel.", variant: "destructive" });
      return;
    }
    const isUserAdmin = cpf in adminMap;
    setGrantingCpf(cpf);
    try {
      if (isUserAdmin) {
        const { error } = await (supabase as any).from("admin_access").delete().eq("cpf", cpf);
        if (error) throw error;
        toast({ title: "Admin removido", description: u.nickname || u.email || cpf });
      } else {
        const { error } = await (supabase as any).from("admin_access").insert({ cpf, role: "admin", enabled: true });
        if (error) throw error;
        toast({ title: "✅ Agora é admin", description: u.nickname || u.email || cpf });
      }
      await loadAdminMeta();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setGrantingCpf(null);
    }
  };

  // Gera uma senha temporária para o usuário (para quando ele não consegue entrar)
  const handleResetPassword = async () => {
    if (!editUser) return;
    setResettingPassword(true);
    setTempPassword(null);
    try {
      // Reset via RPC SQL (sem edge function — evita o erro de deploy).
      // A função admin_reset_user_password retorna a senha temporária gerada.
      const { data, error } = await (supabase as any).rpc("admin_reset_user_password", {
        p_user_id: editUser.user_id,
      });
      if (error) throw new Error(error.message || "Erro ao redefinir senha");
      setTempPassword(data as string);
      toast({ title: "Senha redefinida", description: "Copie e envie para o usuário." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setResettingPassword(false);
    }
  };

  const copyTempPassword = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  // Abre o modal e carrega o perfil completo do usuário (telefone, CPF, cidade/estado)
  const openEditUser = async (u: SubscriptionUser) => {
    setEditUser(u);
    setLoadingEdit(true);
    setTempPassword(null);
    setCopiedPassword(false);
    setEditForm({ nickname: u.nickname || "", phone: "", cpf: "", city: "", state: "", email: u.email || "" });
    setEditComp({ exempt: Boolean(u.billing_exempt), label: u.comp_label || null });
    const { data } = await supabase
      .from("profiles")
      .select("nickname, phone, cpf, city, state, email, ranking_hidden, billing_exempt, comp_label")
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
      setEditComp({ exempt: Boolean(d.billing_exempt), label: d.comp_label || null });
    }
    // Vendas (resultados) do mês atual, para corrigir/zerar valores falsos
    const now = new Date();
    const inicioMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const { data: sales } = await supabase
      .from("daily_sales")
      .select("id, date, cash_sales, card_sales, pix_sales, total_profit")
      .eq("user_id", u.user_id)
      .gte("date", inicioMes)
      .order("date", { ascending: false });
    const lista = (sales as any[]) || [];
    setUserSales(lista);
    const editsInit: Record<string, string> = {};
    lista.forEach((s) => {
      editsInit[s.id] = String(s.total_profit ?? ((s.cash_sales || 0) + (s.card_sales || 0) + (s.pix_sales || 0)));
    });
    setSaleEdits(editsInit);
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

  // Corrige o valor de um dia: ajusta o total e redistribui dinheiro/cartão/pix
  // proporcionalmente; depois recalcula o ranking a partir do daily_sales.
  const saveSaleDay = async (sale: any, newTotalStr: string) => {
    if (!editUser) return;
    const newTotal = parseFloat(newTotalStr) || 0;
    setSavingSaleId(sale.id);
    try {
      const orig = (sale.cash_sales || 0) + (sale.card_sales || 0) + (sale.pix_sales || 0);
      let cash: number, card: number, pix: number;
      if (orig > 0) {
        const r = newTotal / orig;
        cash = Math.round((sale.cash_sales || 0) * r * 100) / 100;
        card = Math.round((sale.card_sales || 0) * r * 100) / 100;
        pix = Math.round((sale.pix_sales || 0) * r * 100) / 100;
      } else {
        cash = newTotal; card = 0; pix = 0;
      }
      const { error } = await supabase
        .from("daily_sales")
        .update({ cash_sales: cash, card_sales: card, pix_sales: pix, total_profit: newTotal } as any)
        .eq("id", sale.id);
      if (error) throw error;
      await syncLeaderboardRevenue(editUser.user_id);
      setUserSales((prev) => prev.map((s) => (s.id === sale.id ? { ...s, cash_sales: cash, card_sales: card, pix_sales: pix, total_profit: newTotal } : s)));
      toast({ title: "✅ Resultado corrigido", description: "Ranking recalculado." });
    } catch (err: any) {
      toast({ title: "Erro ao corrigir", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSavingSaleId(null);
    }
  };

  // Remove um lançamento de dia inteiro (ex.: venda falsa) e recalcula o ranking.
  const deleteSaleDay = async (sale: any) => {
    if (!editUser) return;
    setSavingSaleId(sale.id);
    try {
      const { error } = await supabase.from("daily_sales").delete().eq("id", sale.id);
      if (error) throw error;
      await syncLeaderboardRevenue(editUser.user_id);
      setUserSales((prev) => prev.filter((s) => s.id !== sale.id));
      toast({ title: "🗑️ Dia removido", description: "Ranking recalculado." });
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSavingSaleId(null);
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
      // Propaga o nome pro RANKING na hora: o leaderboard_stats guarda uma CÓPIA
      // do nome; sem isto, um nome trocado pelo admin continuava aparecendo no
      // ranking (ex.: apagar um nome impróprio). Atualiza todas as entradas do user.
      await supabase
        .from("leaderboard_stats")
        .update({ nome_usuario: editForm.nickname || null } as any)
        .eq("user_id", editUser.user_id);
      toast({ title: "✅ Perfil atualizado", description: editForm.nickname || editUser.email || "" });
      setEditUser(null);
      loadUsers();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  // Marca/atualiza o selo de acesso (cortesia / influenciador / equipe / desconto)
  const applyComp = async (label: string | null, exempt: boolean) => {
    if (!editUser) return;
    setSavingComp(true);
    try {
      const updates: any = { billing_exempt: exempt, comp_label: label };
      if (exempt) { updates.plan_status = "active"; updates.plan_type = "pro"; updates.is_trial_active = false; }
      const { error } = await supabase.from("profiles").update(updates).eq("user_id", editUser.user_id);
      if (error) throw error;
      setEditComp({ exempt, label });
      setUsers((prev) => prev.map((x) => x.user_id === editUser.user_id
        ? { ...x, billing_exempt: exempt, comp_label: label, plan_status: exempt ? "active" : x.plan_status }
        : x));
      toast({ title: label ? `Selo aplicado: ${label}` : "Voltou a Pagante normal" });
    } catch (err: any) {
      toast({ title: "Erro ao aplicar selo", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSavingComp(false);
    }
  };

  const applyDesconto = () => {
    const pct = window.prompt("Qual o desconto dele, em %? (ex.: 50)", "50");
    if (pct === null) return;
    const n = parseInt(String(pct).replace(/\D/g, ""), 10) || 0;
    // Pagou com desconto = continua PAGANTE (entra na receita real da Hotmart), só leva o selo
    applyComp(`Cortesia ${n}%`, false);
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

  const isComp = (u: SubscriptionUser) => Boolean(u.billing_exempt); // cortesia/influenciador/equipe (acesso grátis)
  // Data de hoje no fuso do Brasil (YYYY-MM-DD) e o dia de fim do trial de cada usuário.
  const todayBR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const endDay = (u: SubscriptionUser) => (u.trial_end || "").slice(0, 10);
  // Trial vencendo HOJE (mandar a mensagem de urgência).
  const isUltimoDia = (u: SubscriptionUser) => u.plan_status === "trial" && endDay(u) === todayBR;
  // Já encerrou e NÃO assinou (alvo de win-back).
  const isExpirado = (u: SubscriptionUser) =>
    !isComp(u) && u.plan_status !== "active" && endDay(u) !== "" && endDay(u) < todayBR;

  let filteredUsers = users.filter((u) => {
    // Filtro por aba/status
    if (statusFilter === "assinantes" && !(u.plan_status === "active" && !isComp(u))) return false;
    if (statusFilter === "trial" && u.plan_status !== "trial") return false;
    if (statusFilter === "ultimo_dia" && !isUltimoDia(u)) return false;
    if (statusFilter === "expirados" && !isExpirado(u)) return false;
    if (statusFilter === "cortesias" && !isComp(u)) return false;
    // Busca por texto
    if (!searchEmail) return true;
    const search = searchEmail.toLowerCase();
    return (
      u.email?.toLowerCase().includes(search) ||
      u.nickname?.toLowerCase().includes(search)
    );
  });
  // Nas abas de conversão, ordena pelo fim do trial (mais recente primeiro = mais quente).
  if (statusFilter === "ultimo_dia" || statusFilter === "expirados") {
    filteredUsers = [...filteredUsers].sort((a, b) => endDay(b).localeCompare(endDay(a)));
  }

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
          <div className="flex flex-wrap gap-2 mt-4">
            {([
              ["assinantes", "Assinantes"],
              ["trial", "Trial (3 dias)"],
              ["ultimo_dia", `Último dia (${users.filter(isUltimoDia).length})`],
              ["expirados", `Expirados (${users.filter(isExpirado).length})`],
              ["cortesias", `Cortesias (${users.filter(isComp).length})`],
              ["todos", "Todos"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === key
                    ? key === "ultimo_dia"
                      ? "bg-warning text-warning-foreground"
                      : key === "expirados"
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
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
            {statusFilter === "assinantes" ? "Assinantes" : statusFilter === "trial" ? "Em teste (3 dias)" : statusFilter === "ultimo_dia" ? "Último dia de teste — mande a mensagem! ⏳" : statusFilter === "expirados" ? "Expirados — não assinaram (win-back) 🔁" : statusFilter === "cortesias" ? "Cortesias / Influenciadores" : "Todos os usuários"} ({filteredUsers.length})
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold truncate">{u.nickname || "Sem nome"}</p>
                        {isComp(u) && (
                          <Badge variant="secondary" className="text-xs">{u.comp_label || "Cortesia"}</Badge>
                        )}
                        {!isComp(u) && u.comp_label && (
                          <Badge variant="outline" className="text-xs">{u.comp_label}</Badge>
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
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                      size="sm"
                      variant="outline"
                      className="border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
                      disabled={isUpdating === u.user_id || u.plan_status === "active" || isComp(u)}
                      title="Dar +3 dias de teste gratis"
                      onClick={async () => {
                        setIsUpdating(u.user_id);
                        try {
                          const base = new Date();
                          const atual = (u.trial_end || "").slice(0, 10);
                          if (atual) {
                            const fim = new Date(atual + "T23:59:59-03:00");
                            if (fim.getTime() > base.getTime()) base.setTime(fim.getTime());
                          }
                          base.setDate(base.getDate() + 3);
                          const novo = base.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
                          const { error } = await supabase
                            .from("profiles")
                            .update({ trial_end: novo, is_trial_active: true, plan_status: "trial" })
                            .eq("user_id", u.user_id);
                          if (error) throw error;
                          toast({ title: "🎁 +3 dias liberados!", description: `Novo fim do teste: ${new Date(novo + "T12:00:00").toLocaleDateString("pt-BR")}` });
                          loadUsers();
                        } catch (err: any) {
                          toast({ title: "Erro", description: err.message || "Nao foi possivel dar os 3 dias.", variant: "destructive" });
                        } finally {
                          setIsUpdating(null);
                        }
                      }}
                    >
                      {isUpdating === u.user_id ? <RefreshCw className="w-4 h-4 animate-spin" /> : "+3 dias"}
                    </Button>
                    {(() => {
                      const digits = (u.phone || "").replace(/\D/g, "");
                      if (digits.length < 10) return null;
                      const wa = digits.startsWith("55") ? digits : `55${digits}`;
                      const first = (u.nickname || "").trim().split(/\s+/)[0] || "";
                      const nm = first ? ` ${first}` : "";
                      const horaBR = parseInt(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }), 10);
                      const saud = horaBR < 12 ? "Bom dia" : horaBR < 18 ? "Boa tarde" : "Boa noite";
                      // Mensagem já pronta conforme a aba: urgência no "último dia", win-back nos "expirados".
                      const body =
                        statusFilter === "ultimo_dia"
                          ? `Opa${nm}, beleza? Rick aqui do Orbis. Vi que teu teste fecha hoje e não quis te deixar sair sem dar um alô. Sincero: o que você achou esses dias? Pergunto porque quem segue depois do teste costuma deslanchar de vez — e dá pra continuar com tudo por menos de R$1 por dia. Bora seguir junto? 👊`
                          : statusFilter === "expirados"
                          ? `Opa${nm}, beleza? Rick aqui do Orbis. Vi que você deu uma pausada e fiquei pensando: o que te fez parar, parça? Pergunto de verdade — teus dados tão todos guardados (teu histórico, teus números, teu lugar no ranking) e dá pra voltar de onde parou quando quiser, por menos de R$1 por dia. Me conta o que rolou que eu te ajudo a destravar. Bora voltar pro corre? 👊`
                          : statusFilter === "assinantes"
                          ? `Opa${nm}! Rick aqui do Orbis 👊 Vi que você fechou com a gente e vim te agradecer de coração — bem-vindo ao time, parça. Me conta: como tá sendo teu corre com o app? Qualquer coisa que precisar pra vender mais, é só me chamar aqui direto. Tô na torcida pra te ver fechando muito! 🚀`
                          : `${saud}${nm}! Rick aqui, do time do Orbis. Vi que você entrou no teste do App. 👊`;
                      const msg = encodeURIComponent(body);
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-600/50 text-green-600 hover:bg-green-600 hover:text-white"
                          onClick={() => window.open(`https://wa.me/${wa}?text=${msg}`, "_blank")}
                          title="Falar no WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      );
                    })()}
                    {isSuperAdmin && (() => {
                      const cpf = (u.cpf || "").replace(/\D/g, "");
                      const isUserAdmin = cpf.length === 11 && cpf in adminMap;
                      const isUserSuper = isUserAdmin && adminMap[cpf];
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          className={isUserAdmin
                            ? "border-amber-500/60 text-amber-600 hover:bg-amber-500 hover:text-white"
                            : "border-border text-muted-foreground hover:bg-primary hover:text-primary-foreground"}
                          onClick={() => toggleAdmin(u)}
                          disabled={grantingCpf === cpf || Boolean(isUserSuper)}
                          title={isUserSuper ? "Super admin (protegido)" : isUserAdmin ? "Remover admin" : "Tornar admin"}
                        >
                          {grantingCpf === cpf ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Crown className={`w-4 h-4 ${isUserAdmin ? "fill-amber-500" : ""}`} />
                          )}
                        </Button>
                      );
                    })()}
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
                      disabled={isUpdating === u.user_id || isComp(u)}
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
        <DialogContent className="max-w-md w-[calc(100%-1.5rem)] max-h-[88dvh] p-0 gap-0 flex flex-col overflow-hidden rounded-2xl">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
            <DialogTitle>Editar perfil</DialogTitle>
          </DialogHeader>
          {loadingEdit ? (
            <p className="text-center text-muted-foreground py-12">Carregando...</p>
          ) : (
            <>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
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

              {/* Tipo de acesso: cortesia / influenciador / equipe / desconto */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-sm font-semibold">Tipo de acesso</p>
                <p className="text-xs text-muted-foreground">
                  {editComp.label
                    ? `Atual: ${editComp.label}${editComp.exempt ? " — grátis, não conta como pagante" : " — pagante (entra na receita)"}`
                    : "Atual: Pagante normal"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={!editComp.label ? "default" : "outline"} disabled={savingComp} onClick={() => applyComp(null, false)}>
                    Pagante normal
                  </Button>
                  <Button size="sm" variant={editComp.label === "Influenciador" ? "default" : "outline"} disabled={savingComp} onClick={() => applyComp("Influenciador", true)}>
                    Influenciador (grátis)
                  </Button>
                  <Button size="sm" variant={editComp.label === "Cortesia" ? "default" : "outline"} disabled={savingComp} onClick={() => applyComp("Cortesia", true)}>
                    Cortesia (grátis)
                  </Button>
                  <Button size="sm" variant={editComp.label === "Equipe" ? "default" : "outline"} disabled={savingComp} onClick={() => applyComp("Equipe", true)}>
                    Equipe / Sócio
                  </Button>
                  <Button size="sm" variant="outline" disabled={savingComp} onClick={applyDesconto}>
                    Cortesia com desconto…
                  </Button>
                </div>
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

              {/* Reset de senha (usuário bloqueado) */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Senha temporária</p>
                    <p className="text-xs text-muted-foreground">Use quando o usuário não consegue entrar.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleResetPassword}
                    disabled={resettingPassword}
                  >
                    {resettingPassword ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <><KeyRound className="w-4 h-4 mr-1" /> Gerar</>
                    )}
                  </Button>
                </div>
                {tempPassword && (
                  <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
                    <code className="flex-1 text-sm font-mono tracking-wider select-all">{tempPassword}</code>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={copyTempPassword}>
                      {copiedPassword ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                )}
              </div>

              {/* Corrigir resultados/vendas (anti-trapaça) */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-sm font-semibold">Resultados do mês (corrigir)</p>
                {userSales.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma venda registrada neste mês.</p>
                ) : (
                  <div className="space-y-2">
                    {userSales.map((s) => (
                      <div key={s.id} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-12 shrink-0">
                          {new Date(s.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </span>
                        <div className="relative flex-1 min-w-0">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={saleEdits[s.id] ?? ""}
                            onChange={(e) => setSaleEdits((m) => ({ ...m, [s.id]: e.target.value }))}
                            className="pl-8 h-9"
                          />
                        </div>
                        <Button size="sm" onClick={() => saveSaleDay(s, saleEdits[s.id] ?? "0")} disabled={savingSaleId === s.id} title="Salvar valor">
                          {savingSaleId === s.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => deleteSaleDay(s)}
                          disabled={savingSaleId === s.id}
                          title="Remover este dia"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Ajuste o valor de um dia ou remova um lançamento falso. O ranking recalcula sozinho.
                </p>
              </div>

              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-border bg-background shrink-0">
                <Button variant="outline" onClick={() => setEditUser(null)} disabled={savingEdit}>
                  Cancelar
                </Button>
                <Button onClick={saveEditUser} disabled={savingEdit}>
                  {savingEdit ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Salvar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
