// VANT — strips personal data from free text before it goes to a third-party AI (26/11/2026,
// App Store 5.1.1(i) / 5.1.2(i), LGPD minimisation). Pure, no imports: used by analisar-bug and
// tested by the app's vitest suite. A bug report is written by a person and may carry a CPF, an
// e-mail, a phone, a Pix key, a card or account number, an address, a name or a token pasted from
// a screen. Each match becomes a neutral tag ([CPF], [EMAIL], [NOME]…) so the AI still understands
// the bug.
// Names in free text (26/11, second pass): there is no certain way to find every name, so three
// nets are used together — the names the caller knows (the reporter), what follows a cue
// ("meu nome é", "cliente", "sr."…), and a common Brazilian first name followed by surnames.
// A lone, uncommon first name can still pass: that is why the reporter field is never sent and
// only an admin, by hand, starts an analysis.

const REGRAS: [RegExp, string][] = [
  [/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu, "[EMAIL]"],
  [/[\p{L}\p{N}._%+-]+\s*(?:\(\s*arroba\s*\)|\[\s*arroba\s*\]|\barroba\b)\s*[\p{L}\p{N}.-]+(?:\s*(?:\(?ponto\)?|\.)\s*\p{L}{2,}){1,3}/giu, "[EMAIL]"],
  [/\bhttps?:\/\/\S+/gi, "[LINK]"],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[TOKEN]"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[ID]"],
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[CNPJ]"],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]"],
  [/\b(?:rg|cnh|t[ií]tulo de eleitor|passaporte|pis|nis)\b\s*(?:n[ºo°.]*\s*)?:?\s*[\dxX][\dxX.\-/ ]{4,}/gi, "[DOCUMENTO]"],
  [/\b\d{1,2}\.\d{3}\.\d{3}-?[\dxX]\b/g, "[DOCUMENTO]"],
  [/\b(?:cvv|cvc|c[oó]d(?:igo)?\.? de seguran[cç]a)\s*:?\s*\d{3,4}\b/gi, "[SEGREDO]"],
  [/\b(?:\d[ -]?){13,19}\b/g, "[NUMERO]"],
  [/(?:\+?55\s?)?\(?\b\d{2}\)?\s?9?\s?\d{4}[-\s]?\d{4}\b/g, "[TELEFONE]"],
  [/\b9\s?\d{4}[-\s]?\d{4}\b/g, "[TELEFONE]"],
  [/\b(?:nascid[oa]|nascimento|data de nasc\w*|nasci)\b[^\d\n]{0,12}\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/gi, "[NASCIMENTO]"],
  [/\b\d{5}-?\d{3}\b/g, "[CEP]"],
  [/\b(?:ag[eê]ncia|ag\.?|conta|c\/c|cc)\s*:?\s*\d[\d.-]{2,}\b/gi, "[CONTA]"],
  [/\b(?:rua|r\.|avenida|av\.|travessa|alameda|estrada|rodovia)\s+[^\n,;]{2,60}(?:,\s*n?º?\s*\d+)?/gi, "[ENDERECO]"],
  [/\b(?:senha|password|token|chave pix|pix)\s*[:=]\s*\S+/gi, "[SEGREDO]"],
  [/(^|[\s(,;:])@[A-Za-z0-9._]{3,30}\b/g, "$1[USUARIO]"],
];

// one "name word": capitalised, at least 2 letters; connectors may sit between name words
const PALAVRA = "\\p{Lu}[\\p{L}'’]+";
const SOBRENOMES = `(?:\\s+(?:(?:de|da|do|dos|das|e)\\s+)?${PALAVRA}){0,4}`;
// what usually comes right before a person's name
// (first letter in either case; the NAME itself must be capitalised, so the regex has no "i" flag)
const DEIXA = "(?:[Mm]eu nome [eé]|[Mm]e chamo|[Ee]u sou [oa]|[Ss]ou [oa]|[Cc]hamad[oa]|[Cc]liente|[Cc]omprador[a]?|[Vv]endedor[a]?|[Uu]su[aá]ri[oa]|[Tt]itular|[Ss]r\\.?|[Ss]ra\\.?|[Ss]enhor[a]?|[Dd]ona)";
const POR_DEIXA = new RegExp(`(?<![\\p{L}])(${DEIXA})\\s+(${PALAVRA}${SOBRENOMES})`, "gu");

// the most common first names in Brazil (IBGE), without accents, lower case
const PRENOMES = new Set(("maria jose ana joao antonio francisco carlos paulo pedro lucas luiz luis marcos gabriel rafael daniel marcelo bruno eduardo felipe " +
  "raimundo rodrigo manoel manuel mateus matheus andre fernando fabio leonardo gustavo guilherme leandro tiago thiago anderson ricardo marcio jorge sebastiao " +
  "alexandre roberto edson diego vitor victor sergio claudio caio vinicius julio renato igor samuel henrique alex wellington wesley jonathan jonatas davi david " +
  "bryan brian brayan kevin kauan kaua enzo arthur artur miguel heitor bernardo theo murilo douglas danilo cristiano cristian adriano wagner willian william wilian " +
  "yuri ramon juan geraldo thomas tomas diogo renan ruan natan nathan otavio emerson everton elias isaac icaro italo ivan jeferson jefferson josue juliano junior " +
  "francisca antonia adriana juliana marcia fernanda patricia aline sandra camila amanda bruna jessica leticia julia luciana vanessa mariana gabriela vera vitoria " +
  "larissa claudia beatriz rita luana sonia renata eliane josefa simone natalia cristiane carla debora rosangela jaqueline rosa daniela aparecida marlene terezinha " +
  "raimunda andreia fabiana lucia raquel angela rafaela joana luzia elaine daiane regina sueli alessandra isabela isabel isabella bianca tatiane tatiana viviane " +
  "michele michelle priscila monica carolina karina kelly sabrina thais tais yasmin alice laura helena valentina sophia sofia lorena livia giovana giovanna ingrid").split(" "));
// capitalised words of the app itself that may follow a cue ("vendedor Pro", "cliente Pix"): not names
const DO_APP = new Set("pro vant pix foco vender defcon caixa hotmart open finance mercado pago nubank minha conta relatorio dashboard ranking x1 estoque produtos receita android iphone ios chrome safari google apple play store banco cartao essencial fundador premium admin teste".split(" "));
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const COM_SOBRENOME = new RegExp(`(?<![\\p{L}])(${PALAVRA})(${SOBRENOMES})`, "gu");
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** nomes: names the caller knows belong to people in this report (the reporter…): removed wherever they appear. */
export function semDadosPessoais(texto: unknown, limite = 2000, nomes: unknown[] = []): string {
  let s = String(texto ?? "").slice(0, limite * 2);
  for (const [re, tag] of REGRAS) s = s.replace(re, tag);
  // 1) names the caller knows (each word of 3+ letters, accent/case-insensitive, whole words)
  for (const n of nomes) {
    for (const parte of String(n ?? "").split(/[^\p{L}]+/u).filter((p) => p.length >= 3 && !/^(?:das?|dos?|de)$/i.test(p))) {
      s = s.replace(new RegExp(`(?<![\\p{L}])${escapar(parte)}(?![\\p{L}])`, "giu"), "[NOME]");
    }
  }
  // 2) what follows a cue ("meu nome é João Carlos da Silva" → "meu nome é [NOME]")
  s = s.replace(POR_DEIXA, (m, deixa: string, nome: string) => (DO_APP.has(semAcento(nome.split(/\s+/)[0] ?? "")) ? m : `${deixa} [NOME]`));
  // 3) a common first name followed by at least one surname ("Bryan da Silva pagou" → "[NOME] pagou")
  s = s.replace(COM_SOBRENOME, (m, primeiro: string, resto: string) => (resto && PRENOMES.has(semAcento(primeiro)) ? "[NOME]" : m));
  return s.replace(/\[NOME\](?:\s+\[NOME\])+/g, "[NOME]").slice(0, limite);
}
