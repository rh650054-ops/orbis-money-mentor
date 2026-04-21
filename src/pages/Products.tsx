import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Products() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold gradient-text">Produtos / Estoque</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus produtos</p>
        </div>
      </div>

      <Card className="glass">
        <CardContent className="p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted/40 mx-auto flex items-center justify-center">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Em breve</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastre produtos, controle estoque e tenha visão clara do seu inventário.
            </p>
          </div>
          <Button disabled className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar produto
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
