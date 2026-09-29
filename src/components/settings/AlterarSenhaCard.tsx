import { useState } from "react";
import { KeyRound, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const MIN_LEN = 8; // mesma regra que o servidor cobra no cadastro desde 14/09/2026

/**
 * Troca de senha pelo próprio usuário (logado).
 * Segurança: antes de gravar a senha nova, confere a senha ATUAL com um
 * signInWithPassword no e-mail interno da sessão. Assim, alguém que pegue o
 * celular desbloqueado não consegue trocar a senha sem saber a antiga.
 */
export default function AlterarSenhaCard({ email }: { email: string | undefined }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const limpar = () => {
    setAtual("");
    setNova("");
    setConfirma("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Sessão inválida", description: "Entre de novo e tente outra vez.", variant: "destructive" });
      return;
    }
    if (nova.length < MIN_LEN) {
      toast({ title: "Senha muito curta", description: `Use no mínimo ${MIN_LEN} caracteres.`, variant: "destructive" });
      return;
    }
    if (nova === atual) {
      toast({ title: "Senha igual", description: "A senha nova precisa ser diferente da atual.", variant: "destructive" });
      return;
    }
    if (nova !== confirma) {
      toast({ title: "Senhas diferentes", description: "Confirme a mesma senha nos dois campos.", variant: "destructive" });
      return;
    }

    setLoading(true);
    // 1. Confere a senha atual (não revela nada além de "certa/errada")
    const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: atual });
    if (checkError) {
      setLoading(false);
      toast({ title: "Senha atual incorreta", description: "Confira a senha que você usa hoje.", variant: "destructive" });
      return;
    }
    // 2. Grava a nova
    const { error } = await supabase.auth.updateUser({ password: nova });
    setLoading(false);
    if (error) {
      toast({ title: "Não foi possível trocar", description: error.message, variant: "destructive" });
      return;
    }
    limpar();
    setDone(true);
    toast({ title: "✅ Senha alterada", description: "Use a senha nova no próximo login." });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-4 text-left">
          <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center text-primary">
            <KeyRound className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Alterar senha</p>
            <p className="text-xs text-muted-foreground">Troque a senha da sua conta quando quiser</p>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {open && (done ? (
          <div className="flex items-center gap-2 text-sm text-primary py-2">
            <CheckCircle2 className="w-4 h-4" /> Senha alterada com sucesso.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="senha-atual" className="text-xs">Senha atual</Label>
              <Input id="senha-atual" type="password" autoComplete="current-password" value={atual}
                onChange={(e) => setAtual(e.target.value)} required className="h-11 rounded-lg bg-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha-nova" className="text-xs">Nova senha (mín. {MIN_LEN} caracteres)</Label>
              <Input id="senha-nova" type="password" autoComplete="new-password" value={nova}
                onChange={(e) => setNova(e.target.value)} minLength={MIN_LEN} required className="h-11 rounded-lg bg-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha-confirma" className="text-xs">Confirme a nova senha</Label>
              <Input id="senha-confirma" type="password" autoComplete="new-password" value={confirma}
                onChange={(e) => setConfirma(e.target.value)} minLength={MIN_LEN} required className="h-11 rounded-lg bg-input" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 rounded-lg font-semibold">
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        ))}
      </CardContent>
    </Card>
  );
}
