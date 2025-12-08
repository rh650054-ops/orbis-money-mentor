import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Pause, Play, AlertCircle, Banknote, CreditCard, Smartphone, AlertTriangle, Lock, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface HourlyBlock {
  id: string;
  hour_index: number;
  hour_label: string;
  target_amount: number;
  achieved_amount: number;
  is_completed: boolean;
  manual_adjustment: number;
  valor_dinheiro: number;
  valor_cartao: number;
  valor_pix: number;
  valor_calote: number;
  timer_status: string;
  timer_started_at: string | null;
  timer_paused_at: string | null;
  timer_elapsed_seconds: number;
}

interface HourlyBlockDetailProps {
  block: HourlyBlock;
  isCurrentBlock: boolean;
  isCompleted: boolean;
  canEdit: boolean;
  onBlockCompleted: (blockId: string, blockIndex: number) => void;
  onBlockUpdated: () => void;
  planId: string;
  allBlocks: HourlyBlock[];
}

export function HourlyBlockDetail({ 
  block, 
  isCurrentBlock,
  isCompleted,
  canEdit,
  onBlockCompleted,
  onBlockUpdated,
  planId,
  allBlocks
}: HourlyBlockDetailProps) {
  const { toast } = useToast();
  const [localBlock, setLocalBlock] = useState(block);
  const [dinheiro, setDinheiro] = useState(block.valor_dinheiro ? block.valor_dinheiro.toString() : "");
  const [cartao, setCartao] = useState(block.valor_cartao ? block.valor_cartao.toString() : "");
  const [pix, setPix] = useState(block.valor_pix ? block.valor_pix.toString() : "");
  const [calote, setCalote] = useState(block.valor_calote ? block.valor_calote.toString() : "");
  const [timeRemaining, setTimeRemaining] = useState(3600);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [reminderShown, setReminderShown] = useState(false);

  // Update local state when prop changes
  useEffect(() => {
    setLocalBlock(block);
    setDinheiro(block.valor_dinheiro ? block.valor_dinheiro.toString() : "");
    setCartao(block.valor_cartao ? block.valor_cartao.toString() : "");
    setPix(block.valor_pix ? block.valor_pix.toString() : "");
    setCalote(block.valor_calote ? block.valor_calote.toString() : "");
  }, [block]);

  // Calculate time remaining based on server timestamps
  const calculateTimeRemaining = useCallback(() => {
    if (localBlock.timer_status === 'idle') return 3600;
    if (localBlock.timer_status === 'finished') return 0;
    
    if (localBlock.timer_status === 'paused') {
      return Math.max(0, 3600 - (localBlock.timer_elapsed_seconds || 0));
    }
    
    if (localBlock.timer_status === 'running' && localBlock.timer_started_at) {
      const startTime = new Date(localBlock.timer_started_at).getTime();
      const now = Date.now();
      const elapsedMs = now - startTime + (localBlock.timer_elapsed_seconds || 0) * 1000;
      const remaining = Math.max(0, 3600 - Math.floor(elapsedMs / 1000));
      return remaining;
    }
    
    return 3600;
  }, [localBlock]);

  // Calculate elapsed seconds for overtime check
  const calculateElapsedSeconds = useCallback(() => {
    if (localBlock.timer_status === 'idle') return 0;
    if (localBlock.timer_status === 'finished') return 3600;
    
    if (localBlock.timer_status === 'paused') {
      return localBlock.timer_elapsed_seconds || 0;
    }
    
    if (localBlock.timer_status === 'running' && localBlock.timer_started_at) {
      const startTime = new Date(localBlock.timer_started_at).getTime();
      const now = Date.now();
      const elapsedMs = now - startTime + (localBlock.timer_elapsed_seconds || 0) * 1000;
      return Math.floor(elapsedMs / 1000);
    }
    
    return 0;
  }, [localBlock]);

  // Timer effect - updates every second when running
  useEffect(() => {
    setTimeRemaining(calculateTimeRemaining());
    
    if (localBlock.timer_status !== 'running') return;
    
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      const elapsed = calculateElapsedSeconds();
      setTimeRemaining(remaining);
      
      // Show reminder at 1h05min (3900 seconds = 65 minutes)
      if (elapsed >= 3900 && !reminderShown && !isCompleted) {
        setReminderShown(true);
        toast({ 
          title: "⏰ Hora passando!", 
          description: "Você passou do tempo! Conclua esta hora agora.",
          variant: "destructive"
        });
        // Auto-complete the block
        handleCompleteHour(true);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [localBlock.timer_status, localBlock.timer_started_at, calculateTimeRemaining, calculateElapsedSeconds, reminderShown, isCompleted]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    const sign = seconds < 0 ? "-" : "";
    return `${sign}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handlePauseTimer = async () => {
    const startTime = new Date(localBlock.timer_started_at!).getTime();
    const now = Date.now();
    const newElapsed = Math.floor((now - startTime) / 1000) + (localBlock.timer_elapsed_seconds || 0);
    
    const { error } = await supabase
      .from("hourly_goal_blocks")
      .update({
        timer_status: 'paused',
        timer_paused_at: new Date().toISOString(),
        timer_elapsed_seconds: newElapsed
      })
      .eq("id", block.id);
    
    if (!error) {
      setLocalBlock(prev => ({
        ...prev,
        timer_status: 'paused',
        timer_paused_at: new Date().toISOString(),
        timer_elapsed_seconds: newElapsed
      }));
      toast({ title: "⏸️ Cronômetro pausado" });
    }
  };

  const handleResumeTimer = async () => {
    const { error } = await supabase
      .from("hourly_goal_blocks")
      .update({
        timer_status: 'running',
        timer_started_at: new Date().toISOString(),
      })
      .eq("id", block.id);
    
    if (!error) {
      setLocalBlock(prev => ({
        ...prev,
        timer_status: 'running',
        timer_started_at: new Date().toISOString()
      }));
      toast({ title: "▶️ Cronômetro retomado" });
    }
  };

  const handleCompleteHour = async (isAutoComplete: boolean = false) => {
    setIsSaving(true);
    
    const valorDinheiro = parseFloat(dinheiro) || 0;
    const valorCartao = parseFloat(cartao) || 0;
    const valorPix = parseFloat(pix) || 0;
    const valorCalote = parseFloat(calote) || 0;
    
    const total = valorDinheiro + valorCartao + valorPix;
    const metaAtingida = total >= block.target_amount;
    
    const { error } = await supabase
      .from("hourly_goal_blocks")
      .update({
        valor_dinheiro: valorDinheiro,
        valor_cartao: valorCartao,
        valor_pix: valorPix,
        valor_calote: valorCalote,
        achieved_amount: total,
        is_completed: true,
        timer_status: 'finished',
        timer_elapsed_seconds: 3600
      })
      .eq("id", block.id);
    
    if (!error) {
      // Redistribute goals if needed
      const shortfall = block.target_amount - total;
      const surplus = total - block.target_amount;
      
      if (surplus > 0 && metaAtingida) {
        await redistributeSurplus(block.hour_index, surplus);
      } else if (shortfall > 0) {
        await redistributeGoals(block.hour_index, shortfall);
      }
      
      if (isAutoComplete) {
        toast({ 
          title: "⏰ Hora concluída automaticamente!", 
          description: `Valores salvos: ${formatCurrency(total)}`
        });
      } else if (metaAtingida) {
        toast({ title: "🔥 Meta da hora batida!", description: "Esse é o foco Visionário! 💙" });
      } else {
        toast({ title: "✅ Hora concluída!", description: "Vamos recuperar na próxima!" });
      }
      
      setIsEditing(false);
      onBlockCompleted(block.id, block.hour_index);
      onBlockUpdated();
    } else {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
    
    setIsSaving(false);
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    
    const valorDinheiro = parseFloat(dinheiro) || 0;
    const valorCartao = parseFloat(cartao) || 0;
    const valorPix = parseFloat(pix) || 0;
    const valorCalote = parseFloat(calote) || 0;
    
    const total = valorDinheiro + valorCartao + valorPix;
    
    const { error } = await supabase
      .from("hourly_goal_blocks")
      .update({
        valor_dinheiro: valorDinheiro,
        valor_cartao: valorCartao,
        valor_pix: valorPix,
        valor_calote: valorCalote,
        achieved_amount: total,
      })
      .eq("id", block.id);
    
    if (!error) {
      toast({ title: "✅ Valores atualizados!" });
      setIsEditing(false);
      onBlockUpdated();
    } else {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
    
    setIsSaving(false);
  };

  const redistributeGoals = async (currentIndex: number, shortfall: number) => {
    const remainingBlocks = allBlocks.filter((b) => b.hour_index > currentIndex && !b.is_completed);
    if (remainingBlocks.length === 0) return;
    
    const additionalPerBlock = shortfall / remainingBlocks.length;
    for (const b of remainingBlocks) {
      const newTarget = b.target_amount + additionalPerBlock;
      await supabase.from("hourly_goal_blocks").update({ target_amount: newTarget }).eq("id", b.id);
    }
  };

  const redistributeSurplus = async (currentIndex: number, surplus: number) => {
    const remainingBlocks = allBlocks.filter((b) => b.hour_index > currentIndex && !b.is_completed);
    if (remainingBlocks.length === 0) return;
    
    const reductionPerBlock = surplus / remainingBlocks.length;
    for (const b of remainingBlocks) {
      const newTarget = Math.max(0, b.target_amount - reductionPerBlock);
      await supabase.from("hourly_goal_blocks").update({ target_amount: newTarget }).eq("id", b.id);
    }
  };

  const total = (parseFloat(dinheiro) || 0) + (parseFloat(cartao) || 0) + (parseFloat(pix) || 0);
  const blockProgress = (total / block.target_amount) * 100;
  const progressPercentage = Math.min(blockProgress, 100);
  const remaining = Math.max(0, block.target_amount - total);

  // Determine if block can be interacted with
  const isLocked = !isCurrentBlock && !isCompleted && !isEditing;
  const showEditButton = isCompleted && !isEditing;
  const showInputs = (isCurrentBlock || isEditing) && !isLocked;

  return (
    <Card
      className={cn(
        "overflow-hidden border-2 transition-all duration-300 rounded-2xl",
        isCurrentBlock && localBlock.timer_status === 'running' && "ring-2 ring-blue-500 shadow-xl shadow-blue-500/30 scale-[1.01]",
        isCompleted && total >= block.target_amount && "bloco-verde",
        isCompleted && total < block.target_amount && "bloco-vermelho",
        isLocked && "opacity-50 border-white/5 bg-black/20",
        !isCompleted && !isCurrentBlock && !isLocked && "border-white/10 bg-black/40 backdrop-blur-sm"
      )}
    >
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold transition-all shadow-lg relative",
              isCompleted && total >= block.target_amount && "bloco-verde-numero",
              isCompleted && total < block.target_amount && "bloco-vermelho-numero",
              isCurrentBlock && localBlock.timer_status === 'running' && "bg-gradient-to-br from-blue-500 to-purple-600 text-white animate-pulse",
              isLocked && "bg-white/5 text-muted-foreground",
              !isCompleted && !isCurrentBlock && !isLocked && "bg-white/5 text-foreground"
            )}>
              {isLocked && (
                <Lock className="absolute -top-1 -right-1 w-5 h-5 text-muted-foreground" />
              )}
              {block.hour_label}
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Meta da Hora</p>
              <p className="text-2xl font-bold">{formatCurrency(block.target_amount)}</p>
              {(isCompleted || total > 0) && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Vendido: {formatCurrency(block.achieved_amount || total)}
                </p>
              )}
            </div>
          </div>
          
          {/* Timer/Status Display */}
          <div className="text-right space-y-2">
            {isCompleted && !isEditing ? (
              <div className="flex flex-col items-end gap-1">
                <CheckCircle2 className={cn(
                  "w-8 h-8",
                  block.achieved_amount >= block.target_amount ? "text-green-500" : "text-yellow-500"
                )} />
                <span className={cn(
                  "text-xs font-semibold",
                  block.achieved_amount >= block.target_amount ? "text-green-500" : "text-yellow-500"
                )}>
                  {block.achieved_amount >= block.target_amount ? "Meta batida!" : "Concluído"}
                </span>
                {showEditButton && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setIsEditing(true)}
                    className="h-7 px-2 text-xs"
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Editar
                  </Button>
                )}
              </div>
            ) : isCurrentBlock ? (
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="none" className="text-white/10" />
                    <circle
                      cx="32" cy="32" r="28"
                      stroke="currentColor" strokeWidth="4" fill="none"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - Math.max(0, timeRemaining) / 3600)}`}
                      className={cn(
                        "transition-all duration-1000",
                        localBlock.timer_status === 'running' ? "text-blue-500" : "text-muted-foreground"
                      )}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn(
                      "text-xs font-mono font-bold",
                      timeRemaining <= 0 ? "text-red-500" : localBlock.timer_status === 'running' ? "text-blue-400" : "text-muted-foreground"
                    )}>
                      {formatTime(timeRemaining)}
                    </span>
                  </div>
                </div>
                
                {/* Timer Controls */}
                <div className="flex gap-1">
                  {localBlock.timer_status === 'running' && (
                    <Button size="sm" variant="outline" onClick={handlePauseTimer} className="h-7 px-2">
                      <Pause className="w-3 h-3" />
                    </Button>
                  )}
                  {localBlock.timer_status === 'paused' && (
                    <Button size="sm" variant="outline" onClick={handleResumeTimer} className="h-7 px-2">
                      <Play className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="w-5 h-5" />
                <span className="text-xs">Aguardando</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar - Always visible */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className={cn(
              "font-semibold",
              (isCompleted || total > 0) && total >= block.target_amount && "bloco-verde-texto",
              (isCompleted || total > 0) && total < block.target_amount && "bloco-vermelho-texto",
              total === 0 && "text-muted-foreground"
            )}>
              {progressPercentage.toFixed(0)}%
            </span>
          </div>
          <Progress 
            value={isCompleted ? (block.achieved_amount / block.target_amount) * 100 : progressPercentage} 
            className={cn(
              "h-2",
              (isCompleted ? block.achieved_amount : total) >= block.target_amount && "bloco-verde-progresso",
              (isCompleted ? block.achieved_amount : total) > 0 && (isCompleted ? block.achieved_amount : total) < block.target_amount && "bloco-vermelho-progresso"
            )}
          />
        </div>

        {/* Payment Method Inputs - Only for current block or editing */}
        {showInputs && (
          <>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Banknote className="w-3 h-3 text-green-500" />
                  Dinheiro
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={dinheiro}
                  onChange={(e) => setDinheiro(e.target.value)}
                  onFocus={(e) => e.target.value === "0" && setDinheiro("")}
                  className="h-9 text-sm border-green-500/30 focus:border-green-500"
                  placeholder="0,00"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-blue-500" />
                  Cartão
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={cartao}
                  onChange={(e) => setCartao(e.target.value)}
                  onFocus={(e) => e.target.value === "0" && setCartao("")}
                  className="h-9 text-sm border-blue-500/30 focus:border-blue-500"
                  placeholder="0,00"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-purple-500" />
                  Pix
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={pix}
                  onChange={(e) => setPix(e.target.value)}
                  onFocus={(e) => e.target.value === "0" && setPix("")}
                  className="h-9 text-sm border-purple-500/30 focus:border-purple-500"
                  placeholder="0,00"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                  Calote
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={calote}
                  onChange={(e) => setCalote(e.target.value)}
                  onFocus={(e) => e.target.value === "0" && setCalote("")}
                  className="h-9 text-sm border-red-500/30 focus:border-red-500"
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Action Button */}
            {isEditing ? (
              <div className="flex gap-2">
                <Button 
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="flex-1 h-11 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {isSaving ? "Salvando..." : "💾 Salvar Alterações"}
                </Button>
                <Button 
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  className="h-11"
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button 
                onClick={() => handleCompleteHour(false)}
                disabled={isSaving}
                className="w-full h-11 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              >
                {isSaving ? "Concluindo..." : "✅ Concluir Hora"}
              </Button>
            )}
          </>
        )}

        {/* Completed block summary (when not editing) */}
        {isCompleted && !isEditing && (
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/10">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">💵</p>
              <p className="text-sm font-semibold">{formatCurrency(block.valor_dinheiro || 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">💳</p>
              <p className="text-sm font-semibold">{formatCurrency(block.valor_cartao || 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">📱</p>
              <p className="text-sm font-semibold">{formatCurrency(block.valor_pix || 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">❌</p>
              <p className="text-sm font-semibold text-red-400">{formatCurrency(block.valor_calote || 0)}</p>
            </div>
          </div>
        )}

        {/* Status Messages for current block */}
        {isCurrentBlock && total > 0 && remaining > 0 && !isCompleted && (
          <div className={cn(
            "flex items-start gap-3 p-3 rounded-xl border backdrop-blur-sm",
            progressPercentage >= 80 ? "bg-yellow-500/10 border-yellow-500/20" : "bg-red-500/10 border-red-500/20"
          )}>
            <AlertCircle className={cn(
              "w-5 h-5 flex-shrink-0 mt-0.5",
              progressPercentage >= 80 ? "text-yellow-500" : "text-red-500"
            )} />
            <div className="flex-1 space-y-1">
              <p className={cn(
                "text-sm font-medium",
                progressPercentage >= 80 ? "text-yellow-500" : "text-red-500"
              )}>
                Faltam {formatCurrency(remaining)} para bater a meta!
              </p>
              <p className="text-xs text-muted-foreground">
                {progressPercentage >= 80 ? "Quase lá! Um último esforço! 💪" : "Vamos acelerar! 🚀"}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
