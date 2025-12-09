import { useState } from "react";
import { Trophy, Crown, Medal, Flame, TrendingUp, ChevronRight, Star, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// Mock data for visual structure - will be replaced with real data later
const mockFaturamentoRanking = [
  { id: "1", name: "Carlos Silva", avatar: null, value: 45000, position: 1 },
  { id: "2", name: "Ana Santos", avatar: null, value: 38500, position: 2 },
  { id: "3", name: "Pedro Lima", avatar: null, value: 32000, position: 3 },
  { id: "4", name: "Maria Costa", avatar: null, value: 28000, position: 4 },
  { id: "5", name: "João Oliveira", avatar: null, value: 25000, position: 5 },
  { id: "6", name: "Lucia Ferreira", avatar: null, value: 22000, position: 6 },
  { id: "7", name: "Roberto Alves", avatar: null, value: 19500, position: 7 },
  { id: "8", name: "Fernanda Souza", avatar: null, value: 17000, position: 8 },
  { id: "9", name: "Bruno Martins", avatar: null, value: 15500, position: 9 },
  { id: "10", name: "Camila Rocha", avatar: null, value: 14000, position: 10 },
];

const mockConstanciaRanking = [
  { id: "1", name: "Ana Santos", avatar: null, days: 28, streak: 25, position: 1 },
  { id: "2", name: "Carlos Silva", avatar: null, days: 26, streak: 20, position: 2 },
  { id: "3", name: "João Oliveira", avatar: null, days: 24, streak: 18, position: 3 },
  { id: "4", name: "Maria Costa", avatar: null, days: 22, streak: 15, position: 4 },
  { id: "5", name: "Pedro Lima", avatar: null, days: 20, streak: 12, position: 5 },
  { id: "6", name: "Lucia Ferreira", avatar: null, days: 18, streak: 10, position: 6 },
  { id: "7", name: "Roberto Alves", avatar: null, days: 16, streak: 8, position: 7 },
  { id: "8", name: "Fernanda Souza", avatar: null, days: 14, streak: 6, position: 8 },
  { id: "9", name: "Bruno Martins", avatar: null, days: 12, streak: 5, position: 9 },
  { id: "10", name: "Camila Rocha", avatar: null, days: 10, streak: 3, position: 10 },
];

const currentUserFaturamento = { position: 12, value: 12000, nextPosition: 11, nextValue: 13500 };
const currentUserConstancia = { position: 8, days: 14, streak: 6, nextPosition: 7, nextDays: 16 };

const motivationalPhrases = [
  "Dominando o jogo com excelência!",
  "Disciplina é o caminho da vitória!",
  "Liderando com propósito!",
  "No topo, onde pertence!",
];

export default function Ranking() {
  const [activeTab, setActiveTab] = useState<"faturamento" | "constancia">("faturamento");
  const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const getPositionStyle = (position: number) => {
    switch (position) {
      case 1:
        return "bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-yellow-600/20 border-yellow-500/50";
      case 2:
        return "bg-gradient-to-br from-slate-400/20 to-slate-500/10 border-slate-400/50";
      case 3:
        return "bg-gradient-to-br from-orange-600/20 to-amber-700/10 border-orange-600/50";
      default:
        return "bg-card/50 border-border/50";
    }
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-slate-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-orange-600" />;
      default:
        return <span className="text-muted-foreground font-bold">#{position}</span>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="min-h-screen pb-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent">
          Ranking Orbis
        </h1>
        <p className="text-muted-foreground capitalize">{currentMonth}</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 p-1 bg-card/50 rounded-xl border border-border/50 backdrop-blur-sm">
        <Button
          variant="ghost"
          onClick={() => setActiveTab("faturamento")}
          className={cn(
            "flex-1 gap-2 h-12 rounded-lg transition-all",
            activeTab === "faturamento"
              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25"
              : "hover:bg-card/80"
          )}
        >
          <Trophy className="w-5 h-5" />
          Faturamento
        </Button>
        <Button
          variant="ghost"
          onClick={() => setActiveTab("constancia")}
          className={cn(
            "flex-1 gap-2 h-12 rounded-lg transition-all",
            activeTab === "constancia"
              ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25"
              : "hover:bg-card/80"
          )}
        >
          <Flame className="w-5 h-5" />
          Constância
        </Button>
      </div>

      {activeTab === "faturamento" ? (
        <FaturamentoLeague
          ranking={mockFaturamentoRanking}
          currentUser={currentUserFaturamento}
          formatCurrency={formatCurrency}
          getPositionStyle={getPositionStyle}
          getPositionIcon={getPositionIcon}
        />
      ) : (
        <ConstanciaLeague
          ranking={mockConstanciaRanking}
          currentUser={currentUserConstancia}
          getPositionStyle={getPositionStyle}
          getPositionIcon={getPositionIcon}
        />
      )}
    </div>
  );
}

interface FaturamentoLeagueProps {
  ranking: typeof mockFaturamentoRanking;
  currentUser: typeof currentUserFaturamento;
  formatCurrency: (value: number) => string;
  getPositionStyle: (position: number) => string;
  getPositionIcon: (position: number) => React.ReactNode;
}

function FaturamentoLeague({ ranking, currentUser, formatCurrency, getPositionStyle, getPositionIcon }: FaturamentoLeagueProps) {
  const top1 = ranking[0];
  const top2 = ranking[1];
  const top3 = ranking[2];
  const restRanking = ranking.slice(3, 10);

  const progressToNext = currentUser.nextValue > 0 
    ? (currentUser.value / currentUser.nextValue) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* League Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-600/10 border border-yellow-500/30">
          <Trophy className="w-6 h-6 text-yellow-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Liga de Faturamento</h2>
          <p className="text-sm text-muted-foreground">Maiores vendedores do mês</p>
        </div>
      </div>

      {/* Top 1 - Premium Card */}
      <Card className="relative overflow-hidden border-2 border-yellow-500/50 bg-gradient-to-br from-yellow-500/10 via-purple-500/5 to-pink-500/10">
        {/* Holographic Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-transparent to-purple-500/5 animate-pulse" />
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
        
        <CardContent className="relative p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown className="w-8 h-8 text-yellow-500 animate-pulse" />
              <span className="text-sm font-medium text-yellow-500">TOP 1</span>
            </div>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-3xl font-bold text-black shadow-xl shadow-yellow-500/30">
                {top1.name.charAt(0)}
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg">
                <Crown className="w-4 h-4 text-black" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-foreground">{top1.name}</h3>
              <p className="text-3xl font-black bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">
                {formatCurrency(top1.value)}
              </p>
              <p className="text-sm text-muted-foreground italic mt-1">
                "{motivationalPhrases[0]}"
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top 2 & 3 */}
      <div className="grid grid-cols-2 gap-3">
        {/* Top 2 */}
        <Card className={cn("border", getPositionStyle(2))}>
          <CardContent className="p-4 text-center">
            <div className="flex justify-center mb-2">
              <Medal className="w-6 h-6 text-slate-400" />
            </div>
            <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-xl font-bold text-black mb-2">
              {top2.name.charAt(0)}
            </div>
            <h4 className="font-semibold text-sm truncate">{top2.name}</h4>
            <p className="text-lg font-bold text-slate-400">{formatCurrency(top2.value)}</p>
          </CardContent>
        </Card>

        {/* Top 3 */}
        <Card className={cn("border", getPositionStyle(3))}>
          <CardContent className="p-4 text-center">
            <div className="flex justify-center mb-2">
              <Medal className="w-6 h-6 text-orange-600" />
            </div>
            <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-xl font-bold text-black mb-2">
              {top3.name.charAt(0)}
            </div>
            <h4 className="font-semibold text-sm truncate">{top3.name}</h4>
            <p className="text-lg font-bold text-orange-500">{formatCurrency(top3.value)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Your Position Card */}
      <Card className="border-2 border-purple-500/50 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-lg font-bold">
              V
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                  VOCÊ
                </span>
                <span className="text-muted-foreground">#{currentUser.position}</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(currentUser.value)}</p>
            </div>
            <Zap className="w-6 h-6 text-purple-400" />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Para #{currentUser.nextPosition}</span>
              <span className="text-purple-400 font-medium">
                Faltam {formatCurrency(currentUser.nextValue - currentUser.value)}
              </span>
            </div>
            <Progress value={progressToNext} className="h-2 bg-purple-950" />
          </div>
        </CardContent>
      </Card>

      {/* Rest of Top 10 */}
      <div className="space-y-2">
        {restRanking.map((user) => (
          <Card key={user.id} className="border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
            <CardContent className="p-3 flex items-center gap-3">
              <span className="w-8 text-center text-muted-foreground font-bold">
                #{user.position}
              </span>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center font-semibold">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{user.name}</p>
              </div>
              <p className="font-bold text-muted-foreground">{formatCurrency(user.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View Complete Ranking */}
      <Button variant="outline" className="w-full gap-2 h-12 border-border/50">
        Ver ranking completo
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

interface ConstanciaLeagueProps {
  ranking: typeof mockConstanciaRanking;
  currentUser: typeof currentUserConstancia;
  getPositionStyle: (position: number) => string;
  getPositionIcon: (position: number) => React.ReactNode;
}

function ConstanciaLeague({ ranking, currentUser, getPositionStyle, getPositionIcon }: ConstanciaLeagueProps) {
  const top1 = ranking[0];
  const top2 = ranking[1];
  const top3 = ranking[2];
  const restRanking = ranking.slice(3, 10);

  const progressToNext = currentUser.nextDays > 0 
    ? (currentUser.days / currentUser.nextDays) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* League Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-600/10 border border-orange-500/30">
          <Flame className="w-6 h-6 text-orange-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Liga de Constância</h2>
          <p className="text-sm text-muted-foreground">Mais disciplinados do mês</p>
        </div>
      </div>

      {/* Top 1 - Premium Card */}
      <Card className="relative overflow-hidden border-2 border-orange-500/50 bg-gradient-to-br from-orange-500/10 via-red-500/5 to-yellow-500/10">
        {/* Holographic Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-red-500/5 animate-pulse" />
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-red-500/20 rounded-full blur-3xl" />
        
        <CardContent className="relative p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="w-8 h-8 text-orange-500 animate-pulse" />
              <span className="text-sm font-medium text-orange-500">TOP 1</span>
            </div>
            <div className="flex items-center gap-1 text-orange-500">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-bold">{top1.streak} dias seguidos</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-3xl font-bold text-black shadow-xl shadow-orange-500/30">
                {top1.name.charAt(0)}
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
                <Flame className="w-4 h-4 text-black" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-foreground">{top1.name}</h3>
              <p className="text-3xl font-black bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                {top1.days} dias trabalhados
              </p>
              <p className="text-sm text-muted-foreground italic mt-1">
                "Disciplina é o caminho da vitória!"
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top 2 & 3 */}
      <div className="grid grid-cols-2 gap-3">
        {/* Top 2 */}
        <Card className={cn("border", getPositionStyle(2))}>
          <CardContent className="p-4 text-center">
            <div className="flex justify-center mb-2">
              <Medal className="w-6 h-6 text-slate-400" />
            </div>
            <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-xl font-bold text-black mb-2">
              {top2.name.charAt(0)}
            </div>
            <h4 className="font-semibold text-sm truncate">{top2.name}</h4>
            <p className="text-lg font-bold text-slate-400">{top2.days} dias</p>
            <p className="text-xs text-muted-foreground">{top2.streak} seguidos</p>
          </CardContent>
        </Card>

        {/* Top 3 */}
        <Card className={cn("border", getPositionStyle(3))}>
          <CardContent className="p-4 text-center">
            <div className="flex justify-center mb-2">
              <Medal className="w-6 h-6 text-orange-600" />
            </div>
            <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-xl font-bold text-black mb-2">
              {top3.name.charAt(0)}
            </div>
            <h4 className="font-semibold text-sm truncate">{top3.name}</h4>
            <p className="text-lg font-bold text-orange-500">{top3.days} dias</p>
            <p className="text-xs text-muted-foreground">{top3.streak} seguidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Your Position Card */}
      <Card className="border-2 border-orange-500/50 bg-gradient-to-r from-orange-500/10 to-red-500/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-lg font-bold">
              V
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-medium">
                  VOCÊ
                </span>
                <span className="text-muted-foreground">#{currentUser.position}</span>
              </div>
              <p className="text-xl font-bold">{currentUser.days} dias trabalhados</p>
              <p className="text-sm text-muted-foreground">{currentUser.streak} dias consecutivos</p>
            </div>
            <Flame className="w-6 h-6 text-orange-400" />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Para #{currentUser.nextPosition}</span>
              <span className="text-orange-400 font-medium">
                Faltam {currentUser.nextDays - currentUser.days} dias
              </span>
            </div>
            <Progress value={progressToNext} className="h-2 bg-orange-950" />
          </div>
        </CardContent>
      </Card>

      {/* Rest of Top 10 */}
      <div className="space-y-2">
        {restRanking.map((user) => (
          <Card key={user.id} className="border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
            <CardContent className="p-3 flex items-center gap-3">
              <span className="w-8 text-center text-muted-foreground font-bold">
                #{user.position}
              </span>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center font-semibold">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.streak} dias seguidos</p>
              </div>
              <p className="font-bold text-muted-foreground">{user.days} dias</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View Complete Ranking */}
      <Button variant="outline" className="w-full gap-2 h-12 border-border/50">
        Ver ranking completo
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
