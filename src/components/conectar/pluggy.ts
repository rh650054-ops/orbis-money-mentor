/* ============================================================
   PLUGGY CONNECT — abrir o widget de bancos.

   Regra do Rick: nada de API externa dentro do app. Esta é a ÚNICA exceção,
   e ela é obrigatória: o widget é a tela onde o vendedor digita a senha do
   banco dele. Essa senha tem que ir direto pra Pluggy, nunca passar pelo
   Vant — é justamente por isso que a tela é deles e não nossa.

   O script só é baixado quando o vendedor toca no botão. Quem nunca conecta
   banco nunca carrega nada.
   ============================================================ */
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { ehAppDaLoja } from "@/shared/lib/platform";

const CDN = "https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js";

interface PluggyConnectCtor {
  new (opts: {
    connectToken: string;
    includeSandbox?: boolean;
    /** open the bank's OAuth page in the system browser instead of the webview */
    forceOauthInBrowser?: boolean;
    /** item que já existe: abre o widget pra autorizar de novo (Pluggy "update mode") */
    updateItem?: string;
    /** quais bancos aparecem na lista (ids da Pluggy) */
    connectorIds?: number[];
    onSuccess?: (data: { item?: { id?: string } }) => void;
    onError?: (e: unknown) => void;
    onOpen?: () => void;
    onClose?: () => void;
  }): { init: () => unknown };
}

declare global {
  interface Window { PluggyConnect?: PluggyConnectCtor }
}

const ESPERA_SCRIPT_MS = 15_000;
const ESPERA_TOKEN_MS = 45_000;
let carregando: Promise<void> | null = null;

/** Baixa o script uma vez só; chamadas seguintes reaproveitam. Qualquer falha (sem rede, script
 *  que veio sem a Pluggy, demora) limpa tudo: a próxima tentativa começa do zero, em vez de
 *  herdar a falha até a página ser recarregada. */
function carregarScript(): Promise<void> {
  if (window.PluggyConnect) return Promise.resolve();
  if (carregando) return carregando;
  carregando = new Promise<void>((ok, falha) => {
    const s = document.createElement("script");
    const desistir = (motivo: string) => { window.clearTimeout(relogio); carregando = null; s.remove(); falha(new Error(motivo)); };
    const relogio = window.setTimeout(() => desistir("demorou"), ESPERA_SCRIPT_MS);
    s.src = CDN;
    s.async = true;
    s.onload = () => { if (window.PluggyConnect) { window.clearTimeout(relogio); ok(); } else desistir("sem_pluggy"); };
    s.onerror = () => desistir("sem_internet");
    document.head.appendChild(s);
  });
  return carregando;
}

export type ErroPluggy =
  | "precisa_pro" | "precisa_banco_extra" | "pluggy_nao_configurado"
  /** sem rede, ou a tela do banco não baixou */
  | "sem_internet"
  /** a sessão da Vant venceu */
  | "sem_login"
  /** o servidor ou a Pluggy não conseguiram abrir a tela agora */
  | "provedor_fora"
  /** pediu pra autorizar um banco que não está mais ligado a este vendedor */
  | "banco_nao_encontrado"
  /** a tela abriu, o banco recusou e o vendedor fechou sem concluir */
  | "nao_concluiu"
  /** já existe uma tela da Pluggy aberta (toque repetido) */
  | "ja_aberto"
  | "cancelou" | "erro";

export type ResultadoLigar = { itemId: string } | { erro: ErroPluggy };

/* ---- volta do app do banco (OAuth) --------------------------------------------------------
   No celular o vendedor sai pra aprovar no app do banco. Na volta, o sistema pode ter
   recarregado a Vant e a tela da Pluggy sumiu sem avisar nada. Esta marca diz "havia uma
   conexão em andamento": quem abre a tela relê a lista de bancos (use-retorno-do-banco). */
const MARCA = "vant:banco:tentativa";
const MARCA_VALE_MS = 15 * 60_000;
function marcarTentativa() { try { localStorage.setItem(MARCA, String(Date.now())); } catch { /* sem armazenamento: segue */ } }
export function limparTentativa() { try { localStorage.removeItem(MARCA); } catch { /* idem */ } }
/** true se uma conexão foi aberta há pouco e não terminou nesta página */
export function tentativaPendente(agora = Date.now()): boolean {
  try {
    const em = Number(localStorage.getItem(MARCA));
    if (!em) return false;
    if (agora - em > MARCA_VALE_MS) { localStorage.removeItem(MARCA); return false; }
    return true;
  } catch { return false; }
}

const TOKEN_FALHOU: Record<string, ErroPluggy> = {
  precisa_pro: "precisa_pro", precisa_banco_extra: "precisa_banco_extra", pluggy_nao_configurado: "pluggy_nao_configurado",
  sem_login: "sem_login", item_nao_encontrado: "banco_nao_encontrado",
  pluggy_auth: "provedor_fora", pluggy_token: "provedor_fora", erro_interno: "provedor_fora",
};

/** Pede o token curto ao servidor. Traduz cada recusa: sem plano, sem vaga, sessão vencida,
 *  banco que não é dele, servidor/Pluggy fora, ou simplesmente sem rede. */
async function pedirToken(reautorizarItem?: string): Promise<{ token: string; connectorIds: number[] | null } | { erro: ErroPluggy }> {
  let data: any = null;
  let error: any = null;
  let relogio = 0;
  try {
    const pedido = (supabase as any).functions.invoke("pluggy-connect-token", reautorizarItem ? { body: { itemId: reautorizarItem } } : undefined);
    const demora = new Promise<{ data: null; error: { demorou: true } }>((r) => { relogio = window.setTimeout(() => r({ data: null, error: { demorou: true } }), ESPERA_TOKEN_MS); });
    ({ data, error } = await Promise.race([pedido, demora]));
  } catch { return { erro: typeof navigator !== "undefined" && navigator.onLine === false ? "sem_internet" : "provedor_fora" }; }
  finally { window.clearTimeout(relogio); }
  if (error || data?.error) {
    const codigo = String(data?.error ?? "");
    if (TOKEN_FALHOU[codigo]) return { erro: TOKEN_FALHOU[codigo] };
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { erro: "sem_internet" };
    const status = Number(error?.context?.status ?? error?.status ?? 0);
    if (status === 401) return { erro: "sem_login" };
    // FunctionsFetchError = a chamada nem chegou ao servidor
    if (error?.name === "FunctionsFetchError") return { erro: "sem_internet" };
    return { erro: "provedor_fora" };
  }
  const token = String(data?.accessToken ?? "");
  if (!token) return { erro: "provedor_fora" };
  // 22/10/2026: o servidor diz quais bancos mostrar (tira o Inter direto, que exige QR Code)
  const connectorIds = Array.isArray(data?.connectorIds) ? (data.connectorIds as unknown[]).map(Number).filter(Number.isFinite) : null;
  return { token, connectorIds };
}

let pedindo = false; // token sendo pedido ou tela ainda abrindo
let sessao = 0;

/** Pede o token curto ao servidor (que confere o plano e a vaga), abre o widget e devolve o
 *  item_id do banco conectado, ou { erro } dizendo por que não abriu ou não concluiu.
 *
 *  Uma abertura por vez: enquanto o token está sendo pedido ou a tela está abrindo, uma segunda
 *  chamada volta na hora com "ja_aberto" e não cria token nem tela nova. Depois que a tela da
 *  Pluggy está na frente ela cobre o app, então um novo toque só chega se ela sumiu sem avisar:
 *  nesse caso a nova tentativa é aceita (nunca um botão morto até recarregar a página).
 *
 *  `aoAbrir` avisa que a tela da Pluggy está na frente. A partir daí o botão do
 *  Vant pode voltar ao normal: quem manda é o widget. (10/09/2026: o botão
 *  ficava preso em "ABRINDO…" pra sempre quando o widget não respondia — OAuth
 *  em outra aba no celular, init que falha, onClose que nunca dispara.) */
export async function ligarBanco(aoAbrir?: () => void, reautorizarItem?: string): Promise<ResultadoLigar> {
  if (pedindo) return { erro: "ja_aberto" };
  pedindo = true;
  const minha = ++sessao;
  const soltar = () => { if (minha === sessao) pedindo = false; };
  try { return await abrirWidget(() => { soltar(); aoAbrir?.(); }, reautorizarItem); }
  finally { soltar(); if (minha === sessao) limparTentativa(); }
}

async function abrirWidget(aoAbrir?: () => void, reautorizarItem?: string): Promise<ResultadoLigar> {
  const t = await pedirToken(reautorizarItem);
  if ("erro" in t) return t;

  try { await carregarScript(); } catch { return { erro: "sem_internet" }; }
  const Ctor = window.PluggyConnect;
  if (!Ctor) return { erro: "sem_internet" };

  return new Promise((resolve) => {
    let respondeu = false;
    let aberto = false;       // a tela da Pluggy chegou a aparecer
    let bancoRecusou = false; // a Pluggy avisou erro com a tela aberta (o vendedor ainda pode tentar de novo nela)
    const responder = (r: ResultadoLigar) => {
      if (respondeu) return;
      respondeu = true;
      resolve(r);
    };
    const abriu = () => { if (aberto) return; aberto = true; marcarTentativa(); aoAbrir?.(); };
    try {
      const widget = new Ctor({
        connectToken: t.token,
        includeSandbox: false,
        // 03/11/2026: inside the store app the Mercado Pago login opened in the webview and
        // came back to the same "Conectar" screen forever. Pluggy: open OAuth in the system browser.
        forceOauthInBrowser: ehAppDaLoja(),
        ...(reautorizarItem ? { updateItem: reautorizarItem } : {}),
        ...(t.connectorIds && !reautorizarItem ? { connectorIds: t.connectorIds } : {}),
        onOpen: abriu,
        onSuccess: (d) => {
          const id = String(d?.item?.id ?? "");
          responder(id ? { itemId: id } : { erro: "erro" });
        },
        // A Pluggy chama onError em dois momentos: quando a tela nem carrega, e quando o banco
        // recusa algo COM a tela aberta (senha errada, banco fora). No segundo caso a tela
        // continua na frente e o vendedor pode tentar de novo ali mesmo — encerrar aqui jogava
        // fora o sucesso que vinha depois. Só encerra se a tela não chegou a abrir.
        onError: () => { if (aberto) bancoRecusou = true; else responder({ erro: "erro" }); },
        onClose: () => responder({ erro: bancoRecusou ? "nao_concluiu" : "cancelou" }),
      });
      // init pode devolver uma promessa: a falha dela também tem que soltar o botão
      Promise.resolve(widget.init()).then(abriu, () => responder({ erro: "erro" }));
    } catch {
      // o widget não abriu: o botão tem que voltar, nunca ficar "abrindo…"
      responder({ erro: "erro" });
    }
  });
}

/** Confere o banco no servidor, salva a conexão e concede o selo. */
export async function salvarBanco(itemId: string) {
  const { data, error } = await (supabase as any).functions.invoke("pluggy-item", { body: { item_id: itemId } });
  if (error || data?.error) return { ok: false as const, erro: String(data?.error ?? "erro") };
  return {
    ok: true as const,
    banco: String(data?.banco ?? "Banco"),
    verificado: !!data?.verificado,
    /** entradas dos últimos 7 dias que já vieram do banco */
    entradas: Number(data?.entradas) || 0,
  };
}

export interface BancoLigado {
  id: string;
  item_id: string;
  institution_name: string | null;
  institution_logo: string | null;
  status: string | null;
  last_synced_at: string | null;
  created_at?: string | null;
  papel?: "trabalho" | "pessoal" | null;
}

export async function carregarBancos(): Promise<BancoLigado[]> {
  const { data } = await supabase
    .from("bank_connections" as any)
    .select("id, item_id, institution_name, institution_logo, status, last_synced_at, created_at, papel")
    .or("status.is.null,status.neq.deleted") // banco desconectado some da tela (03/10)
    .order("created_at", { ascending: true });
  return ((data as any[]) || []) as BancoLigado[];
}

/** Desconecta um banco: a Pluggy apaga o acesso e a conexão sai da Vant (03/10). */
export async function desligarBanco(conexaoId: string): Promise<{ ok: true; banco: string } | { ok: false; erro: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("pluggy-desligar", { body: { conexao_id: conexaoId } });
    if (error || data?.error) return { ok: false, erro: String(data?.error ?? "erro") };
    return { ok: true, banco: String(data?.banco ?? "Banco") };
  } catch (e) {
    avisar.erro("pluggy: desligar banco", e);
    return { ok: false, erro: "sem_internet" };
  }
}

/** pro = Vant Pro de verdade (selo); liberado = pode usar Open Finance (Pro OU Essencial + banco avulso). */
export interface StatusPro { pro: boolean; origem: string | null; ate: string | null; bancos: number; verificado: boolean; liberado?: boolean }

export async function carregarPro(): Promise<StatusPro> {
  // nunca lança: sem resposta = "não é Pro" e a tela mostra a oferta, em vez de
  // ficar girando pra sempre atrás de um `pro` que nunca chega
  let r: any = null;
  try {
    const { data } = await (supabase as any).rpc("orbis_pro_status");
    r = ((data as any[]) || [])[0];
  } catch (e) { avisar.erro("pluggy: status Pro (segue como não-Pro)", e); }
  return {
    pro: !!r?.pro,
    // banco avulso (Essencial + banco, planos de 06/10/2026): liga o banco sem ser Pro
    liberado: !!r?.pro || r?.origem === "banco_avulso",
    origem: (r?.origem as string) ?? null,
    ate: (r?.ate as string) ?? null,
    bancos: Number(r?.bancos) || 0,
    verificado: !!r?.verificado,
  };
}

/** Estado do banco em português de gente, não de API. */
export function saudeDoBanco(status: string | null, ultimaSync: string | null) {
  const s = String(status ?? "").toUpperCase();
  if (s === "UPDATED") return { texto: "em dia", cor: "#3DD68C", alerta: false };
  // 09/10: WAITING_USER_INPUT aparecia como "atualizando…" pra sempre. É o banco
  // esperando o VENDEDOR aprovar no app do banco (André: nunca aprovou, 0 entradas).
  if (s === "WAITING_USER_INPUT" || s === "WAITING_USER_ACTION" || s === "LOGIN_ERROR" || s === "INVALID_CREDENTIALS" || s === "USER_INPUT_TIMEOUT")
    return { texto: "falta autorizar no app do banco", cor: "#F2465A", alerta: true, autorizar: true };
  if (s === "UPDATING" || s === "LOGIN_IN_PROGRESS")
    return { texto: "atualizando…", cor: "#F5B800", alerta: false };
  if (s === "OUTDATED" || s === "ERROR")
    return { texto: "o banco está fora — não é você", cor: "#ff7a1a", alerta: true };
  if (!ultimaSync) return { texto: "aguardando o banco", cor: "#7b766e", alerta: false };
  return { texto: "conectado", cor: "#3DD68C", alerta: false };
}

export const horaBR = (iso: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  } catch { return ""; }
};

/** Pra que serve cada banco (Rick, 03/10): trabalho = fluxo de caixa; reserva = guardar. */
/* ---------- conta de TRABALHO × PESSOAL (04/10) ----------
   Só Pix que cai em conta de trabalho vira venda. O papel só muda pela RPC
   (o banco recusa gravação direta) e, depois da 1ª escolha, 1 troca a cada 7 dias. */
export type ResultadoPapel = { ok: true } | { ok: false; erro: "trava"; liberadaEm: string | null } | { ok: false; erro: "falha" };

export async function definirPapel(conexaoId: string, papel: "trabalho" | "pessoal"): Promise<ResultadoPapel> {
  const { data, error } = await (supabase as any).rpc("open_finance_definir_papel", { p_conexao: conexaoId, p_papel: papel });
  if (error) { avisar.erro("pluggy: papel do banco", error); return { ok: false, erro: "falha" }; }
  const r = (data ?? {}) as { ok?: boolean; erro?: string; liberada_em?: string };
  if (r.ok) return { ok: true };
  if (r.erro === "trava") return { ok: false, erro: "trava", liberadaEm: r.liberada_em ?? null };
  return { ok: false, erro: "falha" };
}

export interface ContaVenda {
  id: string; banco: string | null; logo: string | null; papel: "trabalho" | "pessoal" | null; saldo: number | null;
  sugestao: "trabalho" | "pessoal" | null; motivo: string | null; entradas_30d: number;
  pode_trocar: boolean; troca_liberada_em: string | null; conta_venda: boolean;
  /** papel escolhido pela Vant ao ligar (começa Trabalho), não pelo vendedor */
  papel_auto?: boolean;
}

/** Cada banco ligado com o papel, o saldo e a sugestão da Vant pelo histórico. */
export async function carregarContasVenda(): Promise<ContaVenda[]> {
  const { data, error } = await (supabase as any).rpc("open_finance_contas");
  if (error) { avisar.silencioso("open_finance_contas", error); return []; }
  return ((data as any[]) || []).map((c) => ({ ...c, saldo: c.saldo == null ? null : Number(c.saldo), entradas_30d: Number(c.entradas_30d) || 0 })) as ContaVenda[];
}

/* ---------- reserva = uma CAIXINHA do banco (04/10) ---------- */
export interface Caixinha { id: string; banco: string | null; nome: string | null; tipo: string | null; saldo: number; reserva: boolean; atualizado_em: string | null }

export async function carregarCaixinhas(): Promise<Caixinha[]> {
  const { data, error } = await (supabase as any).rpc("open_finance_caixinhas");
  if (error) { avisar.silencioso("open_finance_caixinhas", error); return []; }
  return ((data as any[]) || []).map((c) => ({ ...c, saldo: Number(c.saldo) || 0, reserva: !!c.reserva })) as Caixinha[];
}

export async function marcarReserva(id: string, reserva: boolean): Promise<boolean> {
  const { error } = await (supabase as any).rpc("open_finance_marcar_reserva", { p_id: id, p_reserva: reserva });
  if (error) { avisar.erro("open_finance_marcar_reserva", error); return false; }
  return true;
}
