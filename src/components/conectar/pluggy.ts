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

const CDN = "https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js";

interface PluggyConnectCtor {
  new (opts: {
    connectToken: string;
    includeSandbox?: boolean;
    onSuccess?: (data: { item?: { id?: string } }) => void;
    onError?: (e: unknown) => void;
    onClose?: () => void;
  }): { init: () => void };
}

declare global {
  interface Window { PluggyConnect?: PluggyConnectCtor }
}

let carregando: Promise<void> | null = null;

/** baixa o script uma vez só; chamadas seguintes reaproveitam */
function carregarScript(): Promise<void> {
  if (window.PluggyConnect) return Promise.resolve();
  if (carregando) return carregando;
  carregando = new Promise<void>((ok, falha) => {
    const s = document.createElement("script");
    s.src = CDN;
    s.async = true;
    s.onload = () => (window.PluggyConnect ? ok() : falha(new Error("sem_pluggy")));
    s.onerror = () => { carregando = null; falha(new Error("sem_internet")); };
    document.head.appendChild(s);
  });
  return carregando;
}

export type ErroPluggy = "precisa_pro" | "precisa_banco_extra" | "pluggy_nao_configurado" | "sem_internet" | "cancelou" | "erro";

/** Pede o token curto ao servidor (que confere o Pro), abre o widget e devolve
 *  o item_id do banco conectado, ou { erro: "cancelou" } quando o vendedor desiste.
 *
 *  `aoAbrir` avisa que a tela da Pluggy está na frente. A partir daí o botão do
 *  Vant pode voltar ao normal: quem manda é o widget. (10/09/2026: o botão
 *  ficava preso em "ABRINDO…" pra sempre quando o widget não respondia — OAuth
 *  em outra aba no celular, init que falha, onClose que nunca dispara.) */
export async function ligarBanco(aoAbrir?: () => void): Promise<{ itemId: string } | { erro: ErroPluggy }> {
  const { data, error } = await (supabase as any).functions.invoke("pluggy-connect-token");
  if (error || data?.error) {
    const e = String(data?.error ?? "erro");
    return { erro: (e === "precisa_pro" || e === "precisa_banco_extra" || e === "pluggy_nao_configurado" ? e : "erro") as ErroPluggy };
  }
  const token = String(data?.accessToken ?? "");
  if (!token) return { erro: "erro" };

  try { await carregarScript(); } catch { return { erro: "sem_internet" }; }
  const Ctor = window.PluggyConnect;
  if (!Ctor) return { erro: "sem_internet" };

  return new Promise((resolve) => {
    let respondeu = false;
    const responder = (r: { itemId: string } | { erro: ErroPluggy }) => {
      if (respondeu) return;
      respondeu = true;
      resolve(r);
    };
    try {
      const widget = new Ctor({
        connectToken: token,
        includeSandbox: false,
        onSuccess: (d) => {
          const id = String(d?.item?.id ?? "");
          responder(id ? { itemId: id } : { erro: "erro" });
        },
        onError: () => responder({ erro: "erro" }),
        onClose: () => responder({ erro: "cancelou" }),
      });
      widget.init();
      aoAbrir?.();
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
  if (s === "UPDATING" || s === "WAITING_USER_INPUT" || s === "LOGIN_IN_PROGRESS")
    return { texto: "atualizando…", cor: "#F5B800", alerta: false };
  if (s === "LOGIN_ERROR" || s === "INVALID_CREDENTIALS")
    return { texto: "precisa entrar de novo", cor: "#F2465A", alerta: true };
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
