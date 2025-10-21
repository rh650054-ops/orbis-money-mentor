import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Banknote, CreditCard, AlertCircle, Calendar, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const weekData = [
  { name: "Seg", value: 420 },
  { name: "Ter", value: 380 },
  { name: "Qua", value: 520 },
  { name: "Qui", value: 450 },
  { name: "Sex", value: 610 },
  { name: "Sáb", value: 680 },
  { name: "Dom", value: 490 },
];

interface DayRecord {
  date: string;
  total: number;
  pix: number;
  cash: number;
  card: number;
  unpaid: number;
}

const historyData: DayRecord[] = [
  { date: "2025-04-20", total: 520.00, pix: 180, cash: 240, card: 100, unpaid: 40 },
  { date: "2025-04-19", total: 480.00, pix: 200, cash: 180, card: 100, unpaid: 0 },
  { date: "2025-04-18", total: 610.00, pix: 250, cash: 260, card: 100, unpaid: 50 },
];

const paymentIcons = {
  pix: Smartphone,
  cash: Banknote,
  card: CreditCard,
  unpaid: AlertCircle,
};

const paymentColors = {
  pix: "text-secondary",
  cash: "text-success",
  card: "text-primary",
  unpaid: "text-destructive",
};

export default function History() {
  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6 animate-fade-in pb-20 md:pb-8">
      <div className="text-center space-y-2 mb-6">
        <h1 className="text-3xl md:text-4xl font-bold gradient-text">Histórico</h1>
        <p className="text-muted-foreground">Acompanhe sua evolução</p>
      </div>

      <Card className="card-gradient-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução Semanal
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[250px] md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weekData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="hsl(var(--secondary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value) => [`R$ ${value}`, 'Vendido']}
              />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Registros Diários</h2>
        {historyData.map((day) => (
          <Card key={day.date} className="card-gradient-border hover:shadow-glow-primary transition-smooth">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-secondary" />
                  <CardTitle className="text-lg">
                    {new Date(day.date).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                  </CardTitle>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold gradient-text">R$ {day.total.toFixed(2)}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: "pix", label: "PIX", value: day.pix },
                  { key: "cash", label: "Dinheiro", value: day.cash },
                  { key: "card", label: "Cartão", value: day.card },
                  { key: "unpaid", label: "Calote", value: day.unpaid },
                ].map((payment) => {
                  const Icon = paymentIcons[payment.key as keyof typeof paymentIcons];
                  const colorClass = paymentColors[payment.key as keyof typeof paymentColors];
                  
                  return (
                    <div key={payment.key} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                      <Icon className={`h-5 w-5 ${colorClass}`} />
                      <div>
                        <p className="text-xs text-muted-foreground">{payment.label}</p>
                        <p className={`text-sm font-semibold ${colorClass}`}>R$ {payment.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
