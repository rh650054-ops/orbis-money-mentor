import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DailySalesForm from "@/components/DailySalesForm";

export default function Transactions() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return null;
  }

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Nova Venda</h1>
        <p className="text-muted-foreground mt-1">
          Registre suas vendas diárias
        </p>
      </div>

      {/* Formulário de Registro de Vendas */}
      <DailySalesForm userId={user.id} onSaved={() => {}} />
    </div>
  );
}
