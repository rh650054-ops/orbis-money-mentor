import { avisar } from "@/shared/lib/avisar";

/**
 * Traduz as mensagens do Supabase Auth (que chegam em inglês) pra português de gente.
 * Nunca mostra a frase crua pro usuário: se não reconhecer, devolve um texto genérico
 * e guarda a original no log (avisar.silencioso) pra gente aprender o caso novo.
 */
const TABELA: Array<[RegExp, string | ((m: RegExpMatchArray) => string)]> = [
  [/new password should be different/i, "A senha nova precisa ser diferente da atual."],
  [/password should be at least (\d+) character/i, (m) => `A senha precisa ter pelo menos ${m[1]} caracteres.`],
  [/password should contain at least one/i, "A senha precisa misturar letras, números e símbolos."],
  [/known to be weak|easy to guess|pwned/i, "Essa senha é fácil demais de adivinhar. Escolha outra."],
  [/signup requires a valid password|password.*required/i, "Informe uma senha válida."],
  [/invalid login credentials|invalid credentials/i, "CPF/e-mail ou senha incorretos."],
  [/user already registered|already been registered|already exists/i, "Já existe uma conta com esses dados. Se for sua, faça login ou recupere a senha."],
  [/rate limit|too many requests|only request this after (\d+) second/i, "Muitas tentativas. Espere um minuto e tente de novo."],
  [/session missing|session.*expired|jwt expired|refresh_token_not_found|invalid refresh token/i, "Sua sessão expirou. Entre de novo."],
  [/token has expired|otp_expired|invalid.*token|link.*(expired|invalid)/i, "Link expirado ou inválido. Peça um novo."],
  [/same_password/i, "A senha nova precisa ser diferente da atual."],
  [/failed to fetch|networkerror|network request failed|load failed/i, "Sem conexão. Verifique sua internet e tente de novo."],
  [/email not confirmed/i, "E-mail ainda não confirmado."],
  [/user not found/i, "Não encontramos essa conta."],
];

const GENERICO = "Não deu certo agora. Tente de novo em instantes.";

export function traduzirErroAuth(erro: unknown, contexto = "auth"): string {
  const msg = typeof erro === "string" ? erro : (erro as { message?: string } | null)?.message ?? "";
  if (!msg) return GENERICO;
  for (const [re, pt] of TABELA) {
    const m = msg.match(re);
    if (m) return typeof pt === "function" ? pt(m) : pt;
  }
  // Já está em português (ex.: mensagens das nossas edge functions)? Deixa passar.
  if (/[ãõçáéíóúâêô]/i.test(msg) || /\b(senha|conta|tente|não)\b/i.test(msg)) return msg;
  avisar.silencioso(`traduzirErroAuth(${contexto}): mensagem sem tradução`, msg);
  return GENERICO;
}
