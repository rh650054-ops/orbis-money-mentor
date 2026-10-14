// Recuperação de senha por código — regras puras (sem rede), testadas em
// recuperacao-senha.test.ts. A função recuperar-senha só liga as dependências.
//
// Garantias:
//  - "pedir" responde IGUAL e NA HORA para qualquer CPF (existe ou não, tem e-mail
//    confirmado ou não): { ok: true, desafio: <uuid aleatório> }. O trabalho (freio,
//    banco, e-mail) roda depois, fora da resposta, então nem o tempo denuncia a conta.
//  - freio por IP e por CPF ANTES de tocar no banco; falha no freio = não processa.
//  - "verificar" responde igual para código errado, expirado, bloqueado, desafio
//    inexistente ou de outra conta: { ok: false, erro: "codigo" }.
//  - nunca registra código, senha, token, CPF ou e-mail: os logs são só nomes de evento.

export const SENHA_MIN = 8;
export const SENHA_MAX = 72; // limite do bcrypt no Auth

export interface Deps {
  /** cadastro_pode_tentar. Deve LANÇAR em erro (o chamador trata como "não pode"). */
  frear(chave: string, teto: number, janelaMin: number): Promise<boolean>;
  criarDesafio(id: string, cpf: string): Promise<{ email: string; nome: string | null; codigo: string } | null>;
  invalidarDesafio(id: string): Promise<void>;
  verificarDesafio(id: string, codigo: string): Promise<{ status: string; token: string | null }>;
  consumirTroca(token: string): Promise<{ desafioId: string; userId: string } | null>;
  reabrirTroca(desafioId: string): Promise<void>;
  concluirTroca(desafioId: string): Promise<void>;
  /** Troca a senha no Auth. Devolve false se o Auth recusar (política de senha). */
  trocarSenha(userId: string, senha: string): Promise<boolean>;
  enviarCodigo(email: string, nome: string | null, codigo: string): Promise<void>;
  hash(texto: string): Promise<string>;
  novoId(): string;
  log(evento: string): void;
}

export type Resposta =
  | { ok: true; desafio?: string; token?: string }
  | { ok: false; erro: "codigo" | "limite" | "senha_curta" | "senha_longa" | "senhas_diferentes" | "token" | "senha_recusada" | "indisponivel" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[0-9a-f]{64}$/;

export function cpfValido(c: string): boolean {
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

/** Freio que falha FECHADO: erro ou resposta estranha = bloqueia. */
async function pode(deps: Deps, chave: string, teto: number, janelaMin: number): Promise<boolean> {
  try {
    return (await deps.frear(chave, teto, janelaMin)) === true;
  } catch {
    deps.log("freio_indisponivel");
    return false;
  }
}

/** Passo 1. Devolve a resposta e o trabalho a rodar em segundo plano. */
export function pedir(cpfBruto: unknown, ip: string, deps: Deps): { resposta: Resposta; trabalho: Promise<void> } {
  const desafio = deps.novoId();
  const trabalho = (async () => {
    try {
      const cpf = String(cpfBruto ?? "").replace(/\D/g, "");
      if (!cpfValido(cpf)) return;
      const ipH = (await deps.hash(`ip:${ip}`)).slice(0, 32);
      if (!(await pode(deps, `rec:ip:${ipH}`, 10, 60))) return;
      const cpfH = (await deps.hash(`cpf:${cpf}`)).slice(0, 32);
      if (!(await pode(deps, `rec:cpf:${cpfH}`, 5, 60))) return;

      const d = await deps.criarDesafio(desafio, cpf);
      if (!d) return; // sem conta / sem e-mail confirmado: silêncio
      try {
        await deps.enviarCodigo(d.email, d.nome, d.codigo);
      } catch {
        deps.log("email_falhou");
        await deps.invalidarDesafio(desafio).catch(() => deps.log("invalidar_falhou"));
      }
    } catch {
      deps.log("pedir_falhou");
    }
  })();
  return { resposta: { ok: true, desafio }, trabalho };
}

/** Passo 2. Código certo → token de troca (uso único, 10 min). */
export async function verificar(desafio: unknown, codigo: unknown, ip: string, deps: Deps): Promise<Resposta> {
  const id = String(desafio ?? "");
  const cod = String(codigo ?? "").replace(/\D/g, "");
  const ipH = (await deps.hash(`ip:${ip}`)).slice(0, 32);
  if (!(await pode(deps, `recv:ip:${ipH}`, 30, 15))) return { ok: false, erro: "limite" };
  if (!UUID_RE.test(id) || cod.length !== 6) return { ok: false, erro: "codigo" };
  try {
    const r = await deps.verificarDesafio(id, cod);
    if (r.status === "ok" && r.token) return { ok: true, token: r.token };
    return { ok: false, erro: "codigo" };
  } catch {
    deps.log("verificar_falhou");
    return { ok: false, erro: "indisponivel" };
  }
}

/** Passo 3. Token + senha nova → troca no Auth e derruba as sessões. */
export async function trocar(token: unknown, senha: unknown, confirmacao: unknown, ip: string, deps: Deps): Promise<Resposta> {
  const tok = String(token ?? "");
  const s = typeof senha === "string" ? senha : "";
  const c = typeof confirmacao === "string" ? confirmacao : "";
  const ipH = (await deps.hash(`ip:${ip}`)).slice(0, 32);
  if (!(await pode(deps, `rect:ip:${ipH}`, 20, 15))) return { ok: false, erro: "limite" };
  if (!TOKEN_RE.test(tok)) return { ok: false, erro: "token" };
  if (s.length < SENHA_MIN) return { ok: false, erro: "senha_curta" };
  if (new TextEncoder().encode(s).length > SENHA_MAX) return { ok: false, erro: "senha_longa" };
  if (s !== c) return { ok: false, erro: "senhas_diferentes" };

  let troca: { desafioId: string; userId: string } | null;
  try {
    troca = await deps.consumirTroca(tok);
  } catch {
    deps.log("consumir_falhou");
    return { ok: false, erro: "indisponivel" };
  }
  if (!troca) return { ok: false, erro: "token" };

  let trocou: boolean | null = null; // null = Auth fora do ar
  try {
    trocou = await deps.trocarSenha(troca.userId, s);
  } catch {
    deps.log("auth_falhou");
  }
  if (trocou !== true) {
    await deps.reabrirTroca(troca.desafioId).catch(() => deps.log("reabrir_falhou"));
    return { ok: false, erro: trocou === false ? "senha_recusada" : "indisponivel" };
  }

  // senha já trocou: derrubar sessões é obrigatório, tenta de novo se falhar
  for (let i = 0; i < 3; i++) {
    try {
      await deps.concluirTroca(troca.desafioId);
      return { ok: true };
    } catch {
      deps.log("concluir_falhou");
    }
  }
  return { ok: true };
}
