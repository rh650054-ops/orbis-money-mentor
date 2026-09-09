/* ============================================================
   COBRADOR DE CALOTE — pedaços compartilhados.
   O Orbis gera o Pix na carteira DO PRÓPRIO VENDEDOR (edge function
   cobranca-criar) e devolve link + copia-e-cola + QR. A mensagem sai
   pelo WhatsApp DELE, não por robô: a gente só abre o app com o texto
   pronto (deep link wa.me). Quando o cliente paga, o webhook do
   Mercado Pago dá baixa sozinho e abate o calote do dia.
   Regra do Rick: nada de API externa dentro do app — quem fala com a
   carteira é a edge function, no servidor.
   ============================================================ */
import { supabase } from "@/integrations/supabase/client";

export const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export const primeiroNome = (n: string | null | undefined) =>
  (n || "").trim().split(/\s+/)[0] || "";

export const iniciais = (n: string | null | undefined) => {
  const p = (n || "?").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase();
};

export const horaBR = (iso: string | null | undefined) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  } catch { return ""; }
};

/** só os dígitos — é assim que o telefone é guardado e é assim que o wa.me quer */
export const soDigitos = (t: string | null | undefined) => (t || "").replace(/\D/g, "");

/** (11) 9 7731-4408 — só pra mostrar na tela */
export const telefoneBonito = (bruto: string | null | undefined) => {
  const d = soDigitos(bruto).replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return bruto || "";
};

/** número no formato internacional que o WhatsApp aceita */
export const zapNumero = (bruto: string | null | undefined) => {
  const d = soDigitos(bruto);
  if (!d) return "";
  return d.startsWith("55") ? d : `55${d}`;
};

export const telefoneServe = (bruto: string | null | undefined) => {
  const d = soDigitos(bruto).replace(/^55/, "");
  return d.length === 10 || d.length === 11;
};

export interface ClienteDoDia {
  client_id: string;
  nome: string | null;
  telefone: string | null;
  valor: number;
  metodo: string | null;
  hora: string | null;
  cobranca_id: string | null;
  cobranca_status: string | null;
  cobranca_link: string | null;
  cobranca_valor: number | null;
}

export interface Cobranca {
  id: string;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  valor: number;
  descricao: string | null;
  status: string;
  link_url: string | null;
  pix_copia_cola: string | null;
  qr_base64: string | null;
  criada_em: string;
  enviada_em: string | null;
  paga_em: string | null;
  valor_pago: number | null;
  expira_em: string | null;
}

export interface ResumoCobranca {
  pendentes: number;
  pendentes_valor: number;
  pagas_mes: number;
  recuperado_mes: number;
}

export async function carregarClientesDoDia(data?: string): Promise<ClienteDoDia[]> {
  const { data: rows } = await (supabase as any).rpc("cobrancas_do_dia", { p_data: data ?? null });
  return (((rows as any[]) || []).map((r) => ({
    ...r,
    valor: Number(r.valor) || 0,
    cobranca_valor: r.cobranca_valor == null ? null : Number(r.cobranca_valor),
  })) as ClienteDoDia[]);
}

export async function carregarResumo(): Promise<ResumoCobranca> {
  const { data } = await (supabase as any).rpc("cobrancas_resumo");
  const r = ((data as any[]) || [])[0];
  return {
    pendentes: Number(r?.pendentes) || 0,
    pendentes_valor: Number(r?.pendentes_valor) || 0,
    pagas_mes: Number(r?.pagas_mes) || 0,
    recuperado_mes: Number(r?.recuperado_mes) || 0,
  };
}

export async function carregarCobranca(id: string): Promise<Cobranca | null> {
  const { data } = await supabase
    .from("cobrancas" as any)
    .select("id, cliente_nome, cliente_telefone, valor, descricao, status, link_url, pix_copia_cola, qr_base64, criada_em, enviada_em, paga_em, valor_pago, expira_em")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const c = data as any;
  return { ...c, valor: Number(c.valor) || 0, valor_pago: c.valor_pago == null ? null : Number(c.valor_pago) } as Cobranca;
}

/** o texto que vai no WhatsApp. Sai do número DELE, com a cara dele. */
export function mensagemCobranca(p: {
  clienteNome: string | null;
  vendedorNome: string | null;
  valor: number;
  descricao: string | null;
  link: string | null;
}) {
  const oi = primeiroNome(p.clienteNome);
  const eu = primeiroNome(p.vendedorNome);
  const oque = (p.descricao || "").trim();
  const linhas = [
    `${oi ? `Oi ${oi}! ` : "Oi! "}${eu ? `Aqui é o ${eu}. ` : ""}Passando pra lembrar${oque ? ` d${/^[aeiou]/i.test(oque) ? "" : "o"} ${oque}` : " da compra"} — ${fmt(p.valor)}.`,
    "",
    "É só pagar por aqui, cai na hora:",
    p.link || "",
    "",
    "Qualquer coisa me chama. Valeu!",
  ];
  return linhas.filter((l, i) => !(l === "" && linhas[i - 1] === "")).join("\n").trim();
}

/** deep link que abre o WhatsApp do vendedor já na conversa certa */
export const linkZap = (telefone: string | null | undefined, texto: string) => {
  const n = zapNumero(telefone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;
};

export function erroCobranca(codigo: string | null | undefined) {
  switch (codigo) {
    case "sem_conexao": return "Ligue sua carteira primeiro pra poder cobrar.";
    case "carteira_recusou": return "A carteira não aceitou essa cobrança. Confere o valor e tenta de novo.";
    case "valor_invalido": return "Digite um valor maior que zero.";
    case "valor_alto": return "Valor alto demais pra uma cobrança avulsa.";
    case "sem_login": return "Entre na sua conta e tenta de novo.";
    default: return "Não deu pra criar a cobrança agora. Tenta de novo em instantes.";
  }
}
