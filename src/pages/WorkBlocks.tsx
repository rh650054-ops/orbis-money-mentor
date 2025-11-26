import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { DailyReportModal } from '@/components/DailyReportModal';
import { useWorkSession } from '@/hooks/useWorkSession';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Clock, Target, TrendingUp, Play } from 'lucide-react';
import { toast } from 'sonner';

export default function WorkBlocks() {
  const { user } = useAuth();
  const { session, blocks, loading, startWorkSession, updateBlockValue } = useWorkSession();
  const [showReport, setShowReport] = useState(false);
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [blockInputs, setBlockInputs] = useState<{ [key: string]: string }>({});

  // Timer based on timestamp
  useEffect(() => {
    if (!session || session.status !== 'active') return;

    const interval = setInterval(() => {
      const start = new Date(session.start_timestamp).getTime();
      const now = Date.now();
      setElapsedTime(Math.floor((now - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  // Check for completed session and show report
  useEffect(() => {
    if (session?.status === 'finished') {
      loadReport();
    }
  }, [session]);

  const loadReport = async () => {
    if (!session) return;

    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('session_id', session.id)
        .single();

      if (error) throw error;

      if (data) {
        setDailyReport({
          ...data,
          meta_dia: session.meta_dia,
          constancia: session.constancia_dia,
        });
        setShowReport(true);
      }
    } catch (error) {
      console.error('Error loading report:', error);
    }
  };

  const handleStartSession = async () => {
    if (!user) return;

    try {
      // Get planning data
      const { data: profile } = await supabase
        .from('profiles')
        .select('daily_sales_goal, goal_hours')
        .eq('user_id', user.id)
        .single();

      if (!profile?.daily_sales_goal || !profile?.goal_hours) {
        toast.error('Configure seu planejamento primeiro');
        return;
      }

      // Generate hourly schedule
      const startHour = 8; // Default start time
      const hourlySchedule = Array.from({ length: profile.goal_hours }, (_, i) => 
        `${startHour + i}:00-${startHour + i + 1}:00`
      );

      await startWorkSession(profile.daily_sales_goal, profile.goal_hours, hourlySchedule);
    } catch (error) {
      console.error('Error starting session:', error);
      toast.error('Erro ao iniciar sessão');
    }
  };

  const handleSaveBlock = async (blockId: string) => {
    const value = parseFloat(blockInputs[blockId]);
    
    if (isNaN(value) || value < 0) {
      toast.error('Valor inválido');
      return;
    }

    await updateBlockValue(blockId, value);
    setBlockInputs({ ...blockInputs, [blockId]: '' });
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalSold = blocks.reduce((sum, block) => sum + (block.valor_real || 0), 0);
  const progressPercent = session ? (totalSold / session.meta_dia) * 100 : 0;
  const completedBlocks = blocks.filter(block => block.valor_real !== null).length;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
        </div>
      </Layout>
    );
  }

  if (!session || session.status === 'finished') {
    return (
      <Layout>
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="text-center space-y-6">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Ritmo de Trabalho
            </h1>
            
            <Card className="p-8 bg-gradient-to-br from-purple-500/5 to-blue-500/5 border-purple-500/20">
              <div className="space-y-4">
                <Play className="w-16 h-16 mx-auto text-purple-400" />
                <h2 className="text-xl font-semibold">Pronto para começar?</h2>
                <p className="text-muted-foreground">
                  Inicie seu turno para começar a registrar suas vendas por hora
                </p>
                <Button 
                  onClick={handleStartSession}
                  size="lg"
                  className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                >
                  Iniciar Turno
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {dailyReport && (
          <DailyReportModal
            open={showReport}
            onClose={() => setShowReport(false)}
            report={dailyReport}
          />
        )}
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-4xl space-y-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-purple-500 bg-clip-text text-transparent mb-8">
          Ritmo de Trabalho
        </h1>

        {/* Summary Card */}
        <Card className="p-8 bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-purple-500/5 border-purple-500/30 backdrop-blur-sm shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/40 backdrop-blur-sm">
              <div className="p-3 rounded-full bg-purple-500/20">
                <Clock className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Tempo Decorrido</div>
                <div className="text-2xl font-bold">{formatTime(elapsedTime)}</div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/40 backdrop-blur-sm">
              <div className="p-3 rounded-full bg-blue-500/20">
                <Target className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Meta do Dia</div>
                <div className="text-2xl font-bold">R$ {session.meta_dia.toFixed(2)}</div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/40 backdrop-blur-sm">
              <div className="p-3 rounded-full bg-green-500/20">
                <TrendingUp className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Total Vendido</div>
                <div className="text-2xl font-bold text-green-400">R$ {totalSold.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-muted-foreground">Progresso do Dia</span>
              <span className="text-purple-400">{completedBlocks}/{blocks.length} blocos • {progressPercent.toFixed(1)}%</span>
            </div>
            <div className="relative h-3 bg-background/60 rounded-full overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 via-blue-500 to-purple-600 rounded-full transition-all duration-500 shadow-lg"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Hour Blocks */}
        <div className="space-y-4">
          {blocks.map((block, index) => {
            const isCompleted = block.valor_real !== null;
            const isCurrent = !isCompleted && blocks.slice(0, index).every(b => b.valor_real !== null);
            const performanceRatio = isCompleted ? (block.valor_real! / block.ritmo_ideal_hora) : 0;
            
            // Determine block color based on performance
            let blockColorClass = '';
            let circleColorClass = '';
            let borderColorClass = '';
            
            if (isCompleted) {
              if (performanceRatio >= 1) {
                blockColorClass = 'bg-gradient-to-br from-green-500/10 to-emerald-500/5';
                circleColorClass = 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/30';
                borderColorClass = 'border-green-500/30';
              } else if (performanceRatio >= 0.7) {
                blockColorClass = 'bg-gradient-to-br from-yellow-500/10 to-amber-500/5';
                circleColorClass = 'bg-gradient-to-br from-yellow-500 to-amber-600 shadow-lg shadow-yellow-500/30';
                borderColorClass = 'border-yellow-500/30';
              } else {
                blockColorClass = 'bg-gradient-to-br from-red-500/10 to-rose-500/5';
                circleColorClass = 'bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/30';
                borderColorClass = 'border-red-500/30';
              }
            } else if (isCurrent) {
              blockColorClass = 'bg-gradient-to-br from-purple-500/15 via-blue-500/15 to-purple-500/10';
              circleColorClass = 'bg-gradient-to-br from-purple-500 to-blue-600 shadow-xl shadow-purple-500/40 animate-pulse';
              borderColorClass = 'border-purple-500/50';
            } else {
              blockColorClass = 'bg-background/40';
              circleColorClass = 'bg-muted';
              borderColorClass = 'border-muted/50';
            }

            return (
              <Card 
                key={block.id}
                className={`p-6 transition-all duration-500 backdrop-blur-sm ${blockColorClass} ${borderColorClass} hover:shadow-xl`}
              >
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-5 flex-1">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl text-white transition-all duration-300 ${circleColorClass}`}>
                      {block.bloco_index}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="text-2xl font-bold">
                        {block.horario_inicio} - {block.horario_fim}
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">Ritmo ideal:</span>
                        <span className="font-semibold text-green-400 text-base">
                          R$ {block.ritmo_ideal_hora.toFixed(2)}
                        </span>
                      </div>
                      {isCompleted && (
                        <div className="flex items-center gap-3 text-sm animate-fade-in">
                          <span className="text-muted-foreground">Vendido:</span>
                          <span className={`font-bold text-lg ${
                            performanceRatio >= 1 ? 'text-green-400' : 
                            performanceRatio >= 0.7 ? 'text-yellow-400' : 
                            'text-red-400'
                          }`}>
                            R$ {block.valor_real?.toFixed(2)}
                          </span>
                          {performanceRatio >= 1 && (
                            <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 font-semibold">
                              Meta batida! 🔥
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {isCurrent && (
                    <div className="flex items-center gap-3 bg-background/60 p-4 rounded-2xl backdrop-blur-sm">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="R$ 0,00"
                        value={blockInputs[block.id] || ''}
                        onChange={(e) => setBlockInputs({ ...blockInputs, [block.id]: e.target.value })}
                        className="w-36 h-12 text-lg rounded-xl border-purple-500/30 bg-background/80 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                      />
                      <Button 
                        onClick={() => handleSaveBlock(block.id)}
                        size="lg"
                        className="h-12 px-6 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        Salvar
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {dailyReport && (
        <DailyReportModal
          open={showReport}
          onClose={() => setShowReport(false)}
          report={dailyReport}
        />
      )}
    </Layout>
  );
}
