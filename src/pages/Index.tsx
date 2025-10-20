import { ArrowUpRight, ArrowDownRight, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const data = [
  { name: "Seg", value: 400 },
  { name: "Ter", value: 300 },
  { name: "Qua", value: 600 },
  { name: "Qui", value: 800 },
  { name: "Sex", value: 500 },
  { name: "Sáb", value: 700 },
  { name: "Dom", value: 900 },
];

export default function Index() {
  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-8">
        <h1 className="text-4xl md:text-5xl font-bold gradient-text">
          Domine seus números.<br />Domine seu futuro.
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Controle total das suas finanças com insights inteligentes e metas personalizadas
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass card-gradient-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 8.450,00</div>
            <p className="text-xs text-muted-foreground">
              +20.1% em relação ao mês passado
            </p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entradas</CardTitle>
            <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">R$ 12.350,00</div>
            <p className="text-xs text-muted-foreground">
              +15.2% este mês
            </p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saídas</CardTitle>
            <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">R$ 3.900,00</div>
            <p className="text-xs text-muted-foreground">
              -5.3% este mês
            </p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro</CardTitle>
            <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
              <Target className="w-4 h-4 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">R$ 8.450,00</div>
            <p className="text-xs text-muted-foreground">
              Meta: R$ 10.000,00
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Evolução Semanal</CardTitle>
          <CardDescription>
            Acompanhe seu desempenho nos últimos 7 dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(271 91% 65%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(189 94% 43%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `R$ ${value}`}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(271 91% 65%)"
                strokeWidth={2}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Goals Overview */}
      <Card className="glass card-gradient-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Meta Atual</CardTitle>
              <CardDescription>Lucro mensal de R$ 10.000</CardDescription>
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow-primary">
              <Target className="w-6 h-6" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">84.5%</span>
            </div>
            <Progress value={84.5} className="h-3" />
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-3 rounded-lg bg-success/10 border border-success/20">
              <p className="text-sm text-muted-foreground">Alcançado</p>
              <p className="text-xl font-bold text-success">R$ 8.450</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm text-muted-foreground">Faltam</p>
              <p className="text-xl font-bold text-primary">R$ 1.550</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-gradient-primary/10 border border-primary/20">
            <p className="text-sm font-medium text-center">
              💪 Continue assim! Você está quase lá!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
