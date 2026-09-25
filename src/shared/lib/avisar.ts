import { toast } from "@/shared/hooks/use-toast";

/**
 * Canal único pra tratar erro na Vant.
 *
 * - silencioso: cache/preferência/localStorage — não atrapalha o usuário, mas fica registrado.
 * - erro:       leitura de dados (Supabase etc.) — loga no console com contexto.
 * - usuario:    gravação do usuário falhou — loga E mostra toast em pt-BR simples.
 *
 * Os últimos 50 erros ficam em `window.__orbisErros` pra diagnóstico.
 */

type RegistroErro = {
  quando: string;
  nivel: "silencioso" | "erro" | "usuario";
  ctx: string;
  msg?: string;
  erro: unknown;
};

const LIMITE = 50;

declare global {
  interface Window {
    __orbisErros?: RegistroErro[];
  }
}

function guardar(reg: RegistroErro) {
  if (typeof window === "undefined") return; // SSR/teste: nada a guardar
  const lista = (window.__orbisErros ??= []);
  lista.push(reg);
  if (lista.length > LIMITE) lista.splice(0, lista.length - LIMITE);
}

function resumo(e: unknown): string {
  if (!e) return "";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && "message" in e && typeof (e as { message?: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export const avisar = {
  /** Falha irrelevante pro usuário (cache, preferência, animação). Só registra. */
  silencioso(ctx: string, e: unknown) {
    guardar({ quando: new Date().toISOString(), nivel: "silencioso", ctx, erro: e });
    if (import.meta.env?.DEV) console.debug("[orbis] " + ctx, e);
  },

  /** Falha ao ler dados. Loga com contexto; a tela decide se mostra estado vazio/erro. */
  erro(ctx: string, e: unknown) {
    guardar({ quando: new Date().toISOString(), nivel: "erro", ctx, erro: e });
    console.error("[orbis] " + ctx, e);
  },

  /** Falha ao salvar algo do usuário. Loga E avisa com toast em pt-BR simples. */
  usuario(msgPtBr: string, e: unknown, ctx?: string) {
    const contexto = ctx ?? msgPtBr;
    guardar({ quando: new Date().toISOString(), nivel: "usuario", ctx: contexto, msg: msgPtBr, erro: e });
    console.error("[orbis] " + contexto, e);
    try {
      toast({ title: msgPtBr, variant: "destructive" });
    } catch (falhaToast) {
      console.error("[orbis] não consegui mostrar o aviso", falhaToast);
    }
  },

  /** Texto curto de um erro qualquer (pra montar mensagens). */
  resumo,
};

export type { RegistroErro };
