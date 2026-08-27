import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdminAccess {
  whitelisted: boolean;
  role: "admin" | "demo" | null;
  loading: boolean;
}

/**
 * Descobre se o usuário logado é admin do Orbis.
 *
 * Antes isso dependia SÓ da edge function `check-admin-access`: se ela falhasse
 * (rede ruim na rua, token expirado, função fria), o hook devolvia
 * `whitelisted: false` — e o card "Administração" simplesmente sumia do Perfil,
 * como se o admin tivesse perdido o acesso. Nada aparecia na auditoria porque a
 * chamada nem chegava ao servidor.
 *
 * Agora existem DOIS caminhos independentes, rodando em paralelo:
 *   1) RPC `is_orbis_admin()` — direto no banco, compara só os dígitos do CPF.
 *      É o mesmo critério que o RLS usa pra liberar as tabelas de admin.
 *   2) Edge function `check-admin-access` — traz o `role` (admin/demo) e faz o
 *      efeito colateral de marcar o perfil do admin como isento de cobrança.
 *
 * Basta UM dos dois dizer que é admin. Assim o painel não desaparece por causa
 * de uma falha passageira, e a segurança de verdade continua no banco (RLS).
 */
export function useAdminAccess(userId: string | undefined): AdminAccess {
  const [state, setState] = useState<AdminAccess>({
    whitelisted: false,
    role: null,
    loading: true,
  });

  useEffect(() => {
    if (!userId) {
      setState({ whitelisted: false, role: null, loading: false });
      return;
    }
    let vivo = true;

    const check = async () => {
      const [rpcRes, fnRes] = await Promise.allSettled([
        (supabase as any).rpc("is_orbis_admin"),
        supabase.functions.invoke("check-admin-access"),
      ]);

      // Caminho 1: o banco. É o mais confiável — se ele diz que é admin, é.
      let porBanco = false;
      if (rpcRes.status === "fulfilled" && !rpcRes.value?.error) {
        porBanco = rpcRes.value?.data === true;
      }

      // Caminho 2: a edge function (traz o papel e ajusta o perfil do admin).
      let porFuncao = false;
      let role: AdminAccess["role"] = null;
      if (fnRes.status === "fulfilled" && !fnRes.value?.error) {
        const data = fnRes.value?.data as { whitelisted?: boolean; role?: AdminAccess["role"] } | null;
        porFuncao = data?.whitelisted ?? false;
        role = data?.role ?? null;
      } else if (fnRes.status === "rejected" || (fnRes as any)?.value?.error) {
        console.warn("check-admin-access indisponível — usando a checagem do banco.");
      }

      if (!vivo) return;
      const ehAdmin = porBanco || porFuncao;
      setState({
        whitelisted: ehAdmin,
        // Sem papel explícito da função, admin confirmado pelo banco é "admin".
        role: role ?? (porBanco ? "admin" : null),
        loading: false,
      });
    };

    check();
    return () => { vivo = false; };
  }, [userId]);

  return state;
}
