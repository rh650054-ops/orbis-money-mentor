import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { RASCUNHO_VAZIO } from "../types";

// a tiny fake of the products table: insert with an existing id answers 23505, like Postgres
const banco = vi.hoisted(() => ({ linhas: new Map<string, Record<string, unknown>>(), chamadas: [] as string[] }));
vi.mock("@/integrations/supabase/client", () => {
  const tabela = () => ({
    insert: (l: Record<string, unknown>) => ({ select: () => ({ single: async () => {
      banco.chamadas.push("insert");
      const id = String(l.id);
      if (banco.linhas.has(id)) return { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "products_pkey"' } };
      banco.linhas.set(id, l); return { data: { id }, error: null };
    } }) }),
    update: (l: Record<string, unknown>) => ({ eq: (_: string, id: string) => ({ select: () => ({ single: async () => {
      banco.chamadas.push("update");
      banco.linhas.set(id, { ...banco.linhas.get(id), ...l }); return { data: { id }, error: null };
    } }) }) }),
  });
  return { supabase: { from: tabela } };
});
vi.mock("@/components/jornada/useJornada", () => ({ marcarPasso: vi.fn() }));
vi.mock("@/shared/lib/missionEvents", () => ({ emitMissionEvent: vi.fn() }));
vi.mock("./salvar-receita", () => ({ salvarReceita: vi.fn() }));
import { useSalvarProdutoMutation } from "./use-produto-mutations";

const envolver = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
beforeEach(() => { banco.linhas.clear(); banco.chamadas = []; });

describe("criação idempotente do produto novo (23/11)", () => {
  it("o produto novo usa o id escolhido no aparelho", async () => {
    const { result } = renderHook(() => useSalvarProdutoMutation("u1"), { wrapper: envolver });
    const id = await result.current.mutateAsync({ ...RASCUNHO_VAZIO, nome: "Água", novoId: "11111111-1111-4111-8111-111111111111" });
    expect(id).toBe("11111111-1111-4111-8111-111111111111");
    expect(banco.linhas.size).toBe(1);
  });

  it("resposta perdida e nova tentativa: 'já existe' vira atualização do MESMO produto, nunca um segundo", async () => {
    const { result } = renderHook(() => useSalvarProdutoMutation("u1"), { wrapper: envolver });
    const r = { ...RASCUNHO_VAZIO, nome: "Água", preco: 3, novoId: "22222222-2222-4222-8222-222222222222" };
    await result.current.mutateAsync(r);                       // committed, but imagine the phone never got the answer
    const id = await result.current.mutateAsync({ ...r, preco: 3.5 });   // he taps "tentar de novo" (and fixed the price)
    expect(id).toBe(r.novoId);
    expect(banco.linhas.size).toBe(1);
    expect(banco.chamadas).toEqual(["insert", "insert", "update"]);
    expect(banco.linhas.get(r.novoId)).toMatchObject({ name: "Água", sale_price: 3.5 });
  });
});
