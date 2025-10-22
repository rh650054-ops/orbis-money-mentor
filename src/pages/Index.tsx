import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, TrendingDown, Target } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
  { name: "Seg", value: 320 },
  { name: "Ter", value: 450 },
  { name: "Qua", value: 380 },
  { name: "Qui", value: 520 },
  { name: "Sex", value: 610 },
  { name: "Sáb", value: 580 },
  { name: "Dom", value: 490 },
];

export default function Index() {
  const totalBalance = 3250.00;
  const income = 4180.00;
  const expenses = 930.00;
  const dailyProfit = 520.00;
  const monthVariation = "+18.5%";

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Hero Section */}
      <div className="text-center space-y-3 mb-6">
        <h1 className="text-3xl md:text-5xl font-bold text-foreground">
          Domine seus números. Domine seu futuro.
        </h1>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="card-gradient-border hover:shadow-glow-primary transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Total
            </CardTitle>
            <DollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold">
              R$ {totalBalance.toFixed(2)}
            </div>
            <p className="text-xs text-success mt-1">
              {monthVariation} este mês
            </p>
          </CardContent>
        </Card>

        <Card className="card-gradient-border hover:shadow-glow-success transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entradas
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-success">
              R$ {income.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total no mês
            </p>
          </CardContent>
        </Card>

        <Card className="card-gradient-border hover:shadow-glow-primary transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saídas
            </CardTitle>
            <TrendingDown className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-destructive">
              R$ {expenses.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total no mês
            </p>
          </CardContent>
        </Card>

        <Card className="card-gradient-border hover:shadow-glow-secondary transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lucro Diário
            </CardTitle>
            <Target className="h-5 w-5 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-secondary">
              R$ {dailyProfit.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Hoje
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Evolution Chart */}
      <Card className="card-gradient-border">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Evolução Semanal</CardTitle>
          <p className="text-sm text-muted-foreground">Vendas diárias da semana</p>
        </CardHeader>
        <CardContent className="h-[250px] md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="hsl(var(--secondary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value) => [`R$ ${value}`, 'Vendido']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="card-gradient-border bg-gradient-to-br from-card to-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-secondary" />
              Meta do Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-semibold text-secondary">78%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-primary via-secondary to-primary transition-smooth shadow-glow-primary"
                  style={{ width: '78%' }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                R$ 3.250,00 de R$ 4.200,00
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-gradient-border bg-gradient-to-br from-card to-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Motivação Orbis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
              <p className="text-sm font-medium mb-1">🚀 Continue assim!</p>
              <p className="text-xs text-muted-foreground">
                Você aumentou 18.5% suas vendas este mês
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
