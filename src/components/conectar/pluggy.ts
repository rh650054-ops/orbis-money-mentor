/* ============================================================
   PLUGGY CONNECT — abrir o widget de bancos.

   Regra do Rick: nada de API externa dentro do app. Esta é a ÚNICA exceção,
   e ela é obrigatória: o widget é a tela onde o vendedor digita a senha do
   banco dele. Essa senha tem que ir direto pra Pluggy, nunca passar pelo
   Orbis — é justamente por isso que a tela é deles e não nossa.

   O script só é baixado quando o vendedor toca no botão. Quem nunca conecta
   banco nunca carrega nada.
   ============================================================ */
import { supabase } from "@/integrations/supabase/client";

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

export type ErroPluggy = "precisa_pro" | "pluggy_nao_configurado" | "sem_internet" | "cancelou" | "erro";

/** Pede o token curto ao servidor (que confere o Pro), abre o widget e devolve
 *  o item_id do banco conectado. Devolve null quando o vendedor desiste. */
export async function ligarBanco(): Promise<{ itemId: string } | { erro: ErroPluggy }> {
  const { data, error } = await (supabase as any).functions.invoke("pluggy-connect-token");
  if (error || data?.error) {
    const e = String(data?.error ?? "erro");
    return { erro: (e === "precisa_pro" || e === "pluggy_nao_configurado" ? e : "erro") as ErroPluggy };
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
  });
}

/** Confere o banco no servidor, salva a conexão e concede o selo. */
export async function salvarBanco(itemId: string) {
  const { data, error } = await (supabase as any).functions.invoke("pluggy-item", { body: { item_id: itemId } });
  if (error || data?.error) return { ok: false, erro: String(data?.error ?? "erro") };
  return { ok: true, banco: String(data?.banco ?? "Banco"), verificado: !!data?.verificado };
}

export interface BancoLigado {
  id: string;
  item_id: string;
  institution_name: string | null;
  institution_logo: string | null;
  status: string | null;
  last_synced_at: string | null;
}

export async function carregarBancos(): Promise<BancoLigado[]> {
  const { data } = await supabase
    .from("bank_connections" as any)
    .select("id, item_id, institution_name, institution_logo, status, last_synced_at")
    .order("created_at", { ascending: true });
  return ((data as any[]) || []) as BancoLigado[];
}

export interface StatusPro { pro: boolean; origem: string | null; ate: string | null; bancos: number; verificado: boolean }

export async function carregarPro(): Promise<StatusPro> {
  const { data } = await (supabase as any).rpc("orbis_pro_status");
  const r = ((data as any[]) || [])[0];
  return {
    pro: !!r?.pro,
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
