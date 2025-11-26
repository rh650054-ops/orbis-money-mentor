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
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Ritmo de Trabalho
        </h1>

        {/* Summary Card */}
        <Card className="p-6 bg-gradient-to-br from-purple-500/5 to-blue-500/5 border-purple-500/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-purple-400" />
              <div>
                <div className="text-xs text-muted-foreground">Tempo Decorrido</div>
                <div className="text-xl font-bold">{formatTime(elapsedTime)}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Target className="w-8 h-8 text-blue-400" />
              <div>
                <div className="text-xs text-muted-foreground">Meta do Dia</div>
                <div className="text-xl font-bold">R$ {session.meta_dia.toFixed(2)}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-green-400" />
              <div>
                <div className="text-xs text-muted-foreground">Total Vendido</div>
                <div className="text-xl font-bold">R$ {totalSold.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso: {completedBlocks}/{blocks.length} blocos</span>
              <span>{progressPercent.toFixed(1)}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        </Card>

        {/* Hour Blocks */}
        <div className="space-y-4">
          {blocks.map((block, index) => {
            const isCompleted = block.valor_real !== null;
            const isCurrent = !isCompleted && blocks.slice(0, index).every(b => b.valor_real !== null);

            return (
              <Card 
                key={block.id}
                className={`p-4 transition-all ${
                  isCurrent 
                    ? 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/50 shadow-lg' 
                    : isCompleted
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-muted/20 border-muted'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      isCurrent ? 'bg-purple-500 text-white' : 
                      isCompleted ? 'bg-green-500 text-white' : 
                      'bg-muted text-muted-foreground'
                    }`}>
                      {block.bloco_index}
                    </div>

                    <div className="flex-1">
                      <div className="font-semibold">
                        {block.horario_inicio} - {block.horario_fim}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Ritmo ideal: R$ {block.ritmo_ideal_hora.toFixed(2)}
                      </div>
                      {isCompleted && (
                        <div className="text-sm font-semibold text-green-400">
                          Vendido: R$ {block.valor_real?.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                  {isCurrent && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="R$ 0.00"
                        value={blockInputs[block.id] || ''}
                        onChange={(e) => setBlockInputs({ ...blockInputs, [block.id]: e.target.value })}
                        className="w-32"
                      />
                      <Button 
                        onClick={() => handleSaveBlock(block.id)}
                        className="bg-gradient-to-r from-purple-500 to-blue-500"
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
