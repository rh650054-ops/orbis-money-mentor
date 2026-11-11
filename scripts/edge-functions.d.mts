export type Comparacao = {
  funcao: string; iguais: string[]; diferentes: { arquivo: string; tipo: "conteudo" | "so_fim_de_linha" }[];
  soNoRepositorio: string[]; soEmProducao: string[]; desconhecidos: string[]; externas: string[];
  faltandoNoRepositorio: string[]; manifesto: Record<string, { repositorio: string | null; producao: string | null; bytes?: number }>;
  conclusao: "IGUAL" | "DIVERGENTE" | "INCONCLUSIVO"; motivo: string;
};
export function dependencias(pastaFuncoes: string, funcao: string): { arquivos: string[]; externas: string[]; faltando: string[] };
export function destinoDoBaixado(relBaixado: string, funcao: string, esperados: string[]): string | null;
export function comparar(p: { pastaFuncoes: string; pastaBaixada: string; funcao: string }): Comparacao;
export function relatorio(r: Comparacao): string;
export function validarProjeto(lista: unknown, esperado: { ref: string; nome: string; organizacao: string; regiao: string }): { ok: boolean; erros: string[]; visto?: Record<string, unknown> };
export function estadoDasFuncoes(lista: unknown, funcoes: string[], semJwt: string[]): { ok: boolean; erros: string[]; registro: Record<string, { versao: number | null; verify_jwt: boolean | null; atualizado_em: unknown; ezbr_sha256: string | null; status: string | null }> };
