import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";

// Cast to any to support new tables (bank_connections, auto_detected_sales)
// that are not yet reflected in the auto-generated Supabase types.
// Types will be in sync after running: supabase db pull
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseTyped as any;
import {
  Building2,
  Plus,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  Banknote,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BankConnection {
  id: string;
  item_id: string;
  institution_name: string;
  institution_logo: string | null;
  status: string;
  last_synced_at: string | null;
  created_at: string;
}

interface AutoDetectedSale {
  id: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  status: string;
  bank_connections: { institution_name: string } | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

// Dynamically loads the Pluggy Connect widget script
const loadPluggyScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if ((window as any).PluggyConnect) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.pluggy.ai/pluggy-connect/v2.1.2/pluggy-connect.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o widget bancário"));
    document.body.appendChild(script);
  });

export default function BankConnections() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [pendingSales, setPendingSales] = useState<AutoDetectedSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    const [connectionsRes, salesRes] = await Promise.all([
      supabase
        .from("bank_connections")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("auto_detected_sales")
        .select("*, bank_connections(institution_name)")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("transaction_date", { ascending: false }),
    ]);

    if (connectionsRes.data) setConnections(connectionsRes.data);
    if (salesRes.data) setPendingSales(salesRes.data as AutoDetectedSale[]);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime: show toast when new auto_detected_sale arrives
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("auto_sales_inserts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "auto_detected_sales",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          toast({
            title: "💰 Pagamento detectado!",
            description: `${formatCurrency(payload.new.amount)} recebido — confirme para registrar.`,
          });
          loadData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadData, toast]);

  const handleConnectBank = async () => {
    if (!user) return;
    setIsConnecting(true);

    try {
      // Get short-lived connect token from our edge function
      const { data, error } = await supabase.functions.invoke("pluggy-connect-token");
      if (error || !data?.accessToken) {
        throw new Error(error?.message ?? "Não foi possível obter token de conexão");
      }

      // Load the Pluggy Connect widget script
      await loadPluggyScript();

      await new Promise<void>((resolve, reject) => {
        const PluggyConnect = (window as any).PluggyConnect;
        const widget = new PluggyConnect({
          connectToken: data.accessToken,
          onSuccess: async ({ item }: any) => {
            const { error: insertError } = await supabase.from("bank_connections").insert({
              user_id: user.id,
              item_id: item.id,
              institution_name: item.connector?.name ?? "Banco",
              institution_logo: item.connector?.imageUrl ?? null,
              status: "connected",
            });

            if (insertError) {
              toast({
                title: "Erro",
                description: "Não foi possível salvar a conexão bancária.",
                variant: "destructive",
              });
            } else {
              toast({
                title: "✅ Banco conectado!",
                description: `${item.connector?.name ?? "Banco"} conectado. Novas vendas serão detectadas automaticamente.`,
              });
              loadData();
            }
            resolve();
          },
          onError: (err: any) => {
            reject(new Error(err?.message ?? "Erro ao conectar banco"));
          },
          onClose: () => resolve(),
        });
        widget.open();
      });
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message ?? "Não foi possível conectar o banco.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConfirmSale = async (sale: AutoDetectedSale) => {
    if (!user) return;

    // Bloqueia confirmação se o dia de trabalho não foi iniciado para a data da venda
    const { data: session } = await supabase
      .from("work_sessions")
      .select("status")
      .eq("user_id", user.id)
      .eq("planning_date", sale.transaction_date)
      .maybeSingle();

    const sessionStarted = session?.status === "active" || session?.status === "finished";
    if (!sessionStarted) {
      toast({
        title: "⚠️ Dia de trabalho não iniciado!",
        description: `Para confirmar esta venda, inicie o dia de trabalho correspondente à data ${sale.transaction_date} primeiro.`,
        variant: "destructive",
      });
      return;
    }

    setConfirming(sale.id);

    try {
      // Insert into daily_sales as a PIX sale
      const { data: newSale, error: saleError } = await supabase
        .from("daily_sales")
        .insert({
          user_id: user.id,
          date: sale.transaction_date,
          total_profit: sale.amount,
          pix_sales: sale.amount,
          cost: 0,
          total_debt: 0,
          cash_sales: 0,
          card_sales: 0,
          notes: sale.description
            ? `Auto-detectado: ${sale.description}`
            : "Pagamento detectado automaticamente via Open Finance",
        })
        .select("id")
        .single();

      if (saleError) throw saleError;

      // Mark auto_detected_sale as confirmed
      await supabase
        .from("auto_detected_sales")
        .update({ status: "confirmed", daily_sale_id: newSale.id, updated_at: new Date().toISOString() })
        .eq("id", sale.id);

      toast({
        title: "✅ Venda confirmada!",
        description: `${formatCurrency(sale.amount)} registrado no histórico.`,
      });
      loadData();
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível confirmar a venda.",
        variant: "destructive",
      });
    } finally {
      setConfirming(null);
    }
  };

  const handleIgnoreSale = async (saleId: string) => {
    await supabase
      .from("auto_detected_sales")
      .update({ status: "ignored", updated_at: new Date().toISOString() })
      .eq("id", saleId);
    toast({ title: "Transação ignorada", description: "Essa movimentação não foi registrada." });
    loadData();
  };

  const handleDisconnect = async (connectionId: string) => {
    await supabase.from("bank_connections").delete().eq("id", connectionId);
    toast({ title: "Conta desconectada", description: "O banco foi removido com sucesso." });
    loadData();
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contas Bancárias</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Conecte seu banco para registrar vendas automaticamente
          </p>
        </div>
        <Button onClick={handleConnectBank} disabled={isConnecting} className="gap-2 shrink-0">
          {isConnecting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Conectar Banco
        </Button>
      </div>

      {/* Open Finance notice */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-primary">Open Finance — BACEN regulamentado</p>
            <p className="text-muted-foreground mt-1">
              Conecta com Nubank, Itaú, Bradesco, C6 e +200 bancos. Seus dados nunca ficam
              armazenados no app — leitura somente.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Connected banks */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Contas Conectadas
        </h2>

        {isLoading ? (
          <div className="h-24 rounded-xl bg-muted/30 animate-pulse" />
        ) : connections.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Nenhum banco conectado</p>
              <p className="text-sm mt-1">
                Conecte sua conta para detectar vendas automaticamente
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => (
              <Card key={conn.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {conn.institution_logo ? (
                      <img
                        src={conn.institution_logo}
                        alt={conn.institution_name}
                        className="w-10 h-10 rounded-full object-contain bg-white p-1"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{conn.institution_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {conn.last_synced_at
                          ? `Sync: ${format(new Date(conn.last_synced_at), "dd/MM HH:mm", { locale: ptBR })}`
                          : "Aguardando primeiro sync"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={conn.status === "connected" ? "default" : "secondary"}>
                      {conn.status === "connected" ? "Ativo" : conn.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive h-8 w-8"
                      onClick={() => handleDisconnect(conn.id)}
                      title="Desconectar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Pending auto-detected sales */}
      {!isLoading && pendingSales.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Banknote className="w-5 h-5 text-green-400" />
            Vendas Detectadas
            <Badge className="ml-1 bg-green-600">{pendingSales.length}</Badge>
          </h2>

          <div className="space-y-3">
            {pendingSales.map((sale) => (
              <Card key={sale.id} className="border-green-500/20 bg-green-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-2xl font-bold text-green-400">
                        {formatCurrency(sale.amount)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {format(new Date(sale.transaction_date + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                      {sale.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {sale.description}
                        </p>
                      )}
                      {sale.bank_connections && (
                        <p className="text-xs text-muted-foreground">
                          via {sale.bank_connections.institution_name}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className="text-yellow-400 border-yellow-400/40 shrink-0"
                    >
                      Pendente
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 gap-1.5"
                      onClick={() => handleConfirmSale(sale)}
                      disabled={confirming === sale.id}
                    >
                      {confirming === sale.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Confirmar como venda
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5"
                      onClick={() => handleIgnoreSale(sale.id)}
                      disabled={confirming === sale.id}
                    >
                      <X className="w-3.5 h-3.5" />
                      Ignorar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!isLoading && connections.length > 0 && pendingSales.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <Check className="w-10 h-10 mx-auto mb-3 text-green-500 opacity-60" />
            <p className="font-medium">Tudo em dia!</p>
            <p className="text-sm mt-1">Nenhuma venda pendente de confirmação</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
